import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
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
import { BodyPartFilter } from './BodyPartFilter';
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
    setSelection((items) =>
      items.some((item) => item.id === exercise.id)
        ? items.filter((item) => item.id !== exercise.id)
        : items.length < maxSelection
          ? [...items, exercise]
          : items,
    );
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  useEffect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [bodyParts, name]);
  useEffect(() => {
    const timer = setTimeout(() => setName(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const groups = useQuery({
    queryKey: ['training', accountId, 'body-parts'],
    queryFn: ({ signal }) => trainingApi.bodyParts(signal),
  });
  const query = useInfiniteQuery({
    queryKey: ['training', accountId, 'exercises', bodyParts, name],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => trainingApi.exercises(bodyParts, pageParam, signal, name),
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
              <View style={ui.gap}>
                <View style={ui.gap}>
                  <View style={ui.row}>
                    <Text
                      accessibilityRole="header"
                      style={[textStyles['title-md'], { color: p.ink, flex: 1 }]}
                    >
                      Add exercise
                    </Text>
                    <IconButton
                      icon="x"
                      label="Close exercise picker"
                      onPress={onClose}
                      disabled={adding}
                    />
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
                        bodyParts.length
                          ? `Filter body parts (${bodyParts.length} active)`
                          : 'Filter body parts'
                      }
                      onPress={() => {
                        Keyboard.dismiss();
                        setFilterOpen(true);
                      }}
                    />
                  </View>
                  <View style={[ui.row, { flexWrap: 'wrap' }]}>
                    {bodyParts.length === 0 ? (
                      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                        All body parts
                      </Text>
                    ) : (
                      bodyParts.map((part) => (
                        <Pressable
                          key={part}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${part} filter`}
                          onPress={() =>
                            setBodyParts((previous) => previous.filter((value) => value !== part))
                          }
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
                  </View>
                </View>
                {query.isPending ? <Loading /> : null}
                {query.isError && !query.isFetchNextPageError ? (
                  <Failure
                    error={query.error}
                    retry={() => {
                      void query.refetch();
                    }}
                  />
                ) : null}
              </View>
            }
            ListEmptyComponent={
              !query.isPending && !query.isError ? (
                <Text style={{ color: p['ink-muted'] }}>
                  No exercises found. Try another name or body part.
                </Text>
              ) : null
            }
            renderItem={({ item }) => {
              const selected = selection.some((exercise) => exercise.id === item.id);
              const disabled = adding || (!selected && selection.length >= maxSelection);
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
                    onPress={() => setDetailId(item.id)}
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
                    onPress={() => toggle(item)}
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
            }}
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError)
                void query.fetchNextPage({ cancelRefetch: false });
            }}
            ListFooterComponent={listFooter}
          />
          {selection.length > 0 ? (
            <View
              testID="exercise-selection-action"
              aria-hidden={filterOpen || detailId !== null}
              accessibilityElementsHidden={filterOpen || detailId !== null}
              importantForAccessibility={
                filterOpen || detailId !== null ? 'no-hide-descendants' : 'auto'
              }
              style={{
                position: 'absolute',
                bottom: insets.bottom + spacing['space-4'],
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
                title={adding ? 'Adding…' : `Add exercises (${selection.length})`}
                onPress={() => void submit()}
                disabled={adding}
                icon="plus"
              />
            </View>
          ) : null}
        </KeyboardAvoidingView>
        {filterOpen ? (
          <BodyPartFilter
            selected={bodyParts}
            options={groups.data?.items ?? []}
            pending={groups.isPending}
            error={groups.error}
            retry={() => {
              void groups.refetch();
            }}
            onClose={() => setFilterOpen(false)}
            onApply={(parts) => {
              setBodyParts(parts);
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
