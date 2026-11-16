import { Feather } from '@expo/vector-icons';
import React, { useEffect, useId, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextField } from '@/components/TextField';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { BodyPartFilter, type ActivityFilter } from './BodyPartFilter';
import { trainingApi } from '../api';
import { ExerciseDetails } from './ExerciseDetails';
import type { ExerciseSummary } from '../schemas';
import { Button, Failure, IconButton, Loading, ui } from './ui';

export function ExercisePicker({
  accountId,
  onSelect,
  onClose,
  maxSelection = 500,
}: Readonly<{
  accountId: number;
  onSelect: (exercises: ExerciseSummary[]) => Promise<number[]> | number[];
  maxSelection?: number;
  onClose: () => void;
}>) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const submitting = useRef(false);
  const list = useRef<FlatList<ExerciseSummary>>(null);
  const [selection, setSelection] = useState<ExerciseSummary[]>([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(false);
  function toggle(exercise: ExerciseSummary) {
    if (adding) return;
    setSelection((items) => {
      if (items.some((item) => item.id === exercise.id)) {
        return items.filter((item) => item.id !== exercise.id);
      }
      return items.length < maxSelection ? [...items, exercise] : items;
    });
  }
  async function submit() {
    if (submitting.current || !selection.length) return;
    submitting.current = true;
    setAdding(true);
    setAddError(false);
    try {
      const added = await onSelect(selection);
      const remaining = selection.filter((item) => !added.includes(item.id));
      setSelection(remaining);
      if (!remaining.length) onClose();
      else setAddError(true);
    } catch {
      setAddError(true);
    } finally {
      submitting.current = false;
      setAdding(false);
    }
  }
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [bodyParts, setBodyParts] = useState<string[]>([]);
  const [activityType, setActivityType] = useState<ActivityFilter>('all');
  const [activityRevision, setActivityRevision] = useState(0);
  const pickerInstance = useId();
  function selectActivityType(next: ActivityFilter) {
    if (next === activityType) return;
    setActivityType(next);
    setActivityRevision((revision) => revision + 1);
  }
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  useEffect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [bodyParts, name, activityType]);
  useEffect(() => {
    const timer = setTimeout(() => setName(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const groups = useQuery({
    queryKey: ['training', accountId, 'body-parts'],
    queryFn: ({ signal }) => trainingApi.bodyParts(signal),
  });
  const query = useInfiniteQuery({
    queryKey: [
      'training',
      accountId,
      'exercises',
      bodyParts,
      name,
      activityType,
      pickerInstance,
      activityRevision,
    ],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      activityType === 'all'
        ? trainingApi.exercises(bodyParts, pageParam, signal, name)
        : trainingApi.exercises(bodyParts, pageParam, signal, name, activityType),
    getNextPageParam: (page) =>
      page.items.length === page.limit ? page.offset + page.limit : undefined,
  });
  let listFooter = null;
  if (query.isFetchingNextPage) listFooter = <Loading />;
  else if (query.isFetchNextPageError)
    listFooter = (
      <Failure
        error={query.error}
        retry={() => void query.fetchNextPage({ cancelRefetch: false })}
      />
    );
  return (
    <Modal
      onRequestClose={() => {
        if (!adding) onClose();
      }}
      animationType="slide"
    >
      <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
        <KeyboardAvoidingView
          style={ui.screen}
          behavior={Platform.OS === 'ios' ? 'height' : undefined}
        >
          <FlatList
            aria-hidden={filterOpen || detailId !== null}
            accessibilityElementsHidden={filterOpen || detailId !== null}
            importantForAccessibility={
              filterOpen || detailId !== null ? 'no-hide-descendants' : 'auto'
            }
            ref={list}
            testID="exercise-catalogue"
            style={{ flex: 1, minHeight: 0 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            data={query.data?.pages.flatMap((page) => page.items) ?? []}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={[ui.content, selection.length > 0 && { paddingBottom: 120 }]}
            ListHeaderComponent={
              <ExerciseCatalogueHeader
                activityType={activityType}
                onClearActivity={() => selectActivityType('all')}
                search={search}
                setSearch={setSearch}
                setName={setName}
                bodyParts={bodyParts}
                setBodyParts={setBodyParts}
                setFilterOpen={setFilterOpen}
                onClose={onClose}
                adding={adding}
                pending={query.isPending}
                error={query.isError && !query.isFetchNextPageError ? query.error : null}
                onRetry={() => void query.refetch()}
              />
            }
            ListEmptyComponent={
              !query.isPending && !query.isError ? (
                <Text style={{ color: p['ink-muted'] }}>
                  No exercises found. Try another name or body part.
                </Text>
              ) : null
            }
            renderItem={({ item }) => (
              <ExercisePickerRow
                item={item}
                adding={adding}
                selected={selection.some((exercise) => exercise.id === item.id)}
                atCapacity={selection.length >= maxSelection}
                onDetails={() => setDetailId(item.id)}
                onToggle={() => toggle(item)}
              />
            )}
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError)
                void query.fetchNextPage({ cancelRefetch: false });
            }}
            ListFooterComponent={listFooter}
          />
          <ExerciseSelectionAction
            count={selection.length}
            hidden={filterOpen || detailId !== null}
            bottom={insets.bottom}
            adding={adding}
            addError={addError}
            onSubmit={() => void submit()}
          />
        </KeyboardAvoidingView>
        {filterOpen ? (
          <BodyPartFilter
            selected={bodyParts}
            activityType={activityType}
            options={groups.data?.items ?? []}
            pending={groups.isPending}
            error={groups.error}
            retry={() => {
              void groups.refetch();
            }}
            onClose={() => setFilterOpen(false)}
            onApply={(parts, activity) => {
              setBodyParts(parts);
              selectActivityType(activity);
              setFilterOpen(false);
            }}
          />
        ) : null}
        {detailId !== null ? (
          <ExerciseDetails
            accountId={accountId}
            exerciseId={detailId}
            onClose={() => setDetailId(null)}
            onAdd={
              adding ||
              selection.length >= maxSelection ||
              selection.some((item) => item.id === detailId)
                ? undefined
                : (exercise) => {
                    toggle(exercise);
                    setDetailId(null);
                  }
            }
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

function ExercisePickerRow({
  item,
  adding,
  selected,
  atCapacity,
  onDetails,
  onToggle,
}: Readonly<{
  item: ExerciseSummary;
  adding: boolean;
  selected: boolean;
  atCapacity: boolean;
  onDetails: () => void;
  onToggle: () => void;
}>) {
  const p = usePalette();
  const disabled = adding || (!selected && atCapacity);
  return (
    <View
      style={[
        ui.row,
        {
          padding: spacing['space-2'],
          borderRadius: radii['radius-lg'],
          backgroundColor: p['surface-200'],
          borderWidth: 1,
          borderColor: selected ? p.brand : p['surface-200'],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Details for ${item.name}`}
        disabled={adding}
        onPress={onDetails}
        style={[ui.row, { flex: 1 }]}
      >
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: radii['radius-md'],
            overflow: 'hidden',
            backgroundColor: p['surface-300'],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              resizeMode="contain"
              style={{ width: '100%', height: '100%' }}
              accessibilityLabel={item.name}
            />
          ) : (
            <Feather name="activity" size={32} color={p['ink-muted']} />
          )}
        </View>
        <View style={{ flex: 1, gap: spacing['space-1'] }}>
          <Text style={[textStyles.label, { color: p.ink }]}>{item.name}</Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            {(item.body_parts?.join(' · ') || 'Gym exercise').toLowerCase()}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${selected ? 'Deselect' : 'Select'} ${item.name}`}
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={onToggle}
        style={{
          width: sizes['tap-min'],
          height: sizes['tap-min'],
          borderRadius: radii['radius-pill'],
          backgroundColor: selected ? p.brand : p['brand-soft'],
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <Feather
          name={selected ? 'check' : 'plus'}
          size={24}
          color={selected ? p['on-brand'] : p['brand-ink']}
        />
      </Pressable>
    </View>
  );
}

function ExerciseCatalogueHeader({
  activityType,
  onClearActivity,
  search,
  setSearch,
  setName,
  bodyParts,
  setBodyParts,
  setFilterOpen,
  onClose,
  adding,
  pending,
  error,
  onRetry,
}: Readonly<{
  activityType: ActivityFilter;
  onClearActivity: () => void;
  search: string;
  setSearch: (value: string) => void;
  setName: (value: string) => void;
  bodyParts: string[];
  setBodyParts: React.Dispatch<React.SetStateAction<string[]>>;
  setFilterOpen: (open: boolean) => void;
  onClose: () => void;
  adding: boolean;
  pending: boolean;
  error: Error | null;
  onRetry: () => void;
}>) {
  const p = usePalette();
  const activeFilterCount = bodyParts.length + (activityType === 'all' ? 0 : 1);
  return (
    <View style={ui.gap}>
      <View style={ui.gap}>
        <View style={ui.row}>
          <Text
            accessibilityRole="header"
            style={[textStyles['title-md'], { color: p.ink, flex: 1 }]}
          >
            Add exercise
          </Text>
          <IconButton icon="x" label="Close exercise picker" onPress={onClose} disabled={adding} />
        </View>
        <View style={ui.row}>
          <TextField
            containerStyle={{ flex: 1 }}
            leading={<Feather name="search" size={20} color={p['ink-muted']} />}
            trailing={
              search ? (
                <IconButton
                  icon="x"
                  label="Clear exercise search"
                  onPress={() => {
                    setSearch('');
                    setName('');
                  }}
                />
              ) : null
            }
            accessibilityLabel="Search exercises"
            placeholder="Search by name"
            maxLength={200}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            onSubmitEditing={() => setName(search.trim())}
          />
          <IconButton
            icon="sliders"
            label={
              activeFilterCount > 0
                ? `Filter body parts (${activeFilterCount} active)`
                : 'Filter body parts'
            }
            onPress={() => {
              Keyboard.dismiss();
              setFilterOpen(true);
            }}
          />
        </View>
        <View style={[ui.row, { flexWrap: 'wrap' }]}>
          {activityType !== 'all' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${activityType === 'cardio' ? 'Cardio' : 'Gym'} filter`}
              onPress={onClearActivity}
              style={[
                ui.row,
                {
                  minHeight: sizes['tap-min'],
                  padding: spacing['space-3'],
                  borderRadius: radii['radius-pill'],
                  backgroundColor: p['brand-soft'],
                },
              ]}
            >
              <Text style={[textStyles['body-sm'], { color: p['brand-ink'] }]}>
                {activityType === 'cardio' ? 'Cardio' : 'Gym'}
              </Text>
              <Feather name="x" size={16} color={p['brand-ink']} />
            </Pressable>
          ) : null}
          {activityType !== 'cardio' ? (
            <CatalogueBodyPartBadges bodyParts={bodyParts} setBodyParts={setBodyParts} />
          ) : null}
          {bodyParts.length > 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear all body part filters"
              onPress={() => setBodyParts([])}
              style={({ pressed }) => ({
                alignSelf: 'center',
                minHeight: sizes['tap-min'],
                justifyContent: 'center',
                paddingHorizontal: spacing['space-2'],
                opacity: pressed ? 0.55 : 1,
              })}
            >
              <Text style={[textStyles.label, { color: p['brand-ink'] }]}>Clear all</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {pending ? <Loading /> : null}
      {error !== null ? <Failure error={error} retry={onRetry} /> : null}
    </View>
  );
}

function ExerciseSelectionAction({
  count,
  hidden,
  bottom,
  adding,
  addError,
  onSubmit,
}: Readonly<{
  count: number;
  hidden: boolean;
  bottom: number;
  adding: boolean;
  addError: boolean;
  onSubmit: () => void;
}>) {
  const p = usePalette();
  if (count === 0) return null;
  return (
    <View
      testID="exercise-selection-action"
      aria-hidden={hidden}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      style={{
        position: 'absolute',
        bottom: bottom + spacing['space-4'],
        left: spacing['space-4'],
        right: spacing['space-4'],
        alignSelf: 'center',
        gap: spacing['space-2'],
      }}
    >
      {addError ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          Could not add all exercises. Your remaining selection is kept. Try again.
        </Text>
      ) : null}
      <Button
        title={adding ? 'Adding…' : `Add exercises (${count})`}
        onPress={onSubmit}
        disabled={adding}
        icon="plus"
      />
    </View>
  );
}

function CatalogueBodyPartBadges({
  bodyParts,
  setBodyParts,
}: Readonly<{
  bodyParts: string[];
  setBodyParts: React.Dispatch<React.SetStateAction<string[]>>;
}>) {
  const p = usePalette();
  return (
    <>
      {bodyParts.length === 0 ? (
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>All body parts</Text>
      ) : (
        bodyParts.map((part) => (
          <Pressable
            key={part}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${part} filter`}
            onPress={() => setBodyParts((previous) => previous.filter((value) => value !== part))}
            style={[
              ui.row,
              {
                minHeight: sizes['tap-min'],
                padding: spacing['space-3'],
                borderRadius: radii['radius-pill'],
                backgroundColor: p['brand-soft'],
              },
            ]}
          >
            <Text style={[textStyles['body-sm'], { color: p['brand-ink'] }]}>
              {part.toLowerCase()}
            </Text>
            <Feather name="x" size={16} color={p['brand-ink']} />
          </Pressable>
        ))
      )}
    </>
  );
}
