import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { FlatList, Image, Keyboard, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextField } from '@/components/TextField';
import { radii, sizes, spacing, usePalette } from '@/theme/tokens';
import { BodyPartFilter } from './BodyPartFilter';
import { trainingApi } from '../api';
import { ExerciseDetails } from './ExerciseDetails';
import type { ExerciseSummary } from '../schemas';
import { Button, Failure, Loading, ui } from './ui';

export function ExercisePicker({
  accountId,
  onSelect,
  onClose,
}: Readonly<{
  accountId: number;
  onSelect: (exercise: ExerciseSummary) => void;
  onClose: () => void;
}>) {
  const p = usePalette();
  const list = useRef<FlatList<ExerciseSummary>>(null);
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
    <Modal onRequestClose={onClose} animationType="slide">
      <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
        <FlatList
          accessibilityElementsHidden={filterOpen}
          importantForAccessibility={filterOpen ? 'no-hide-descendants' : 'auto'}
          ref={list}
          testID="exercise-catalogue"
          style={{ flex: 1, minHeight: 0 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          data={query.data?.pages.flatMap((page) => page.items) ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={ui.content}
          ListHeaderComponent={
            <View style={ui.gap}>
              <View style={ui.gap}>
                <View style={ui.row}>
                  <Text style={[ui.title, { color: p.ink, flex: 1 }]}>Exercises</Text>
                  <Button title="Done" onPress={onClose} secondary />
                </View>
                <TextField
                  accessibilityLabel="Search exercises"
                  placeholder="Search by name"
                  maxLength={200}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                  onSubmitEditing={() => setName(search.trim())}
                />
                <Button
                  title={bodyParts.length ? `Filters (${bodyParts.length})` : 'Filters'}
                  accessibilityLabel="Filter body parts"
                  onPress={() => {
                    Keyboard.dismiss();
                    setFilterOpen(true);
                  }}
                  secondary
                />
                <View style={[ui.row, { flexWrap: 'wrap' }]}>
                  {bodyParts.length === 0 ? (
                    <Text style={{ color: p['ink-muted'] }}>All body parts</Text>
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
                        <Text style={{ color: p['brand-ink'] }}>{part}</Text>
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
          renderItem={({ item }) => (
            <View style={[ui.card, { backgroundColor: p['surface-200'] }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Details for ${item.name}`}
                onPress={() => setDetailId(item.id)}
                style={ui.row}
              >
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={{ width: 64, height: 64, borderRadius: 12 }}
                    accessibilityLabel={item.name}
                  />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.ink, fontSize: 17, fontWeight: '600' }}>{item.name}</Text>
                  <Text style={{ color: p['ink-muted'] }}>
                    {item.body_parts?.join(' · ') || 'Gym exercise'}
                  </Text>
                </View>
              </Pressable>
              <Button
                title="Add"
                accessibilityLabel={`Add ${item.name}`}
                tone="positive"
                onPress={() => onSelect(item)}
              />
            </View>
          )}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError)
              void query.fetchNextPage({ cancelRefetch: false });
          }}
          ListFooterComponent={listFooter}
        />
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
            onAdd={onSelect}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
