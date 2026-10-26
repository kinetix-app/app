import React, { useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { usePalette } from '@/theme/tokens';
import { trainingApi } from '../api';
import type { CompletedSession, WeightUnit } from '../schemas';
import { Button, Failure, IconButton, Loading, ui } from './ui';

export function WorkoutHistory({
  accountId,
  onClose,
}: Readonly<{ accountId: number; onClose: () => void }>) {
  const p = usePalette();
  const unit: WeightUnit = 'kg';
  const [selected, setSelected] = useState<number | null>(null);
  const list = useInfiniteQuery({
    queryKey: ['training', accountId, 'sessions', unit],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => trainingApi.sessions(pageParam, unit, signal),
    getNextPageParam: (page) =>
      page.items.length === page.limit ? page.offset + page.limit : undefined,
  });
  const detail = useQuery({
    queryKey: ['training', accountId, 'session', selected, unit],
    enabled: selected !== null,
    queryFn: ({ signal }) => trainingApi.session(selected ?? 0, unit, signal),
  });
  let detailContent = null;
  if (detail.isPending) detailContent = <Loading />;
  else if (detail.isError)
    detailContent = <Failure error={detail.error} retry={() => void detail.refetch()} />;
  else if (detail.data)
    detailContent = <SessionDetails session={detail.data} unit={unit} palette={p} />;
  let footer = null;
  if (list.isFetchingNextPage) footer = <Loading />;
  else if (list.isFetchNextPageError)
    footer = (
      <Failure error={list.error} retry={() => void list.fetchNextPage({ cancelRefetch: false })} />
    );
  const back = () => (selected === null ? onClose() : setSelected(null));
  const header = (
    <View style={ui.gap}>
      <View style={ui.row}>
        <IconButton
          icon="arrow-left"
          label={selected === null ? 'Back to routines' : 'Back to history'}
          onPress={back}
        />
        <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
          Workout history
        </Text>
      </View>
    </View>
  );
  if (selected !== null)
    return (
      <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
        <ScrollView contentContainerStyle={ui.content}>
          {header}
          {detailContent}
        </ScrollView>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
      <FlatList
        contentContainerStyle={ui.content}
        data={list.data?.pages.flatMap((page) => page.items) ?? []}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View style={ui.gap}>
            {header}
            {list.isPending ? <Loading /> : null}
            {list.isError ? (
              <Failure
                error={list.error}
                retry={() => {
                  void list.refetch();
                }}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !list.isPending && !list.isError ? (
            <Text style={{ color: p['ink-muted'] }}>No completed workouts yet.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[ui.card, { backgroundColor: p['surface-200'] }]}>
            <Text style={{ color: p.ink }}>
              {new Date(item.ended_at).toLocaleString()} · {item.exercises.length} exercises
            </Text>
            <Button
              title="View workout"
              accessibilityLabel={`View workout ${item.id}`}
              secondary
              onPress={() => setSelected(item.id)}
            />
          </View>
        )}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetching && !list.isFetchNextPageError)
            void list.fetchNextPage({ cancelRefetch: false });
        }}
        ListFooterComponent={footer}
      />
    </SafeAreaView>
  );
}

function SessionDetails({
  session,
  unit,
  palette,
}: Readonly<{
  session: CompletedSession;
  unit: WeightUnit;
  palette: ReturnType<typeof usePalette>;
}>) {
  return (
    <View style={ui.gap}>
      <Text style={{ color: palette.ink }}>
        Completed {new Date(session.ended_at).toLocaleString()}
      </Text>
      <Text style={{ color: palette['ink-muted'] }}>
        Started {new Date(session.started_at).toLocaleString()}
      </Text>
      {session.exercises.map((slot) => (
        <View key={slot.id} style={[ui.card, { backgroundColor: palette['surface-200'] }]}>
          <Text style={[ui.heading, { color: palette.ink }]}>
            {slot.exercise_order}. {slot.exercise.name}
          </Text>
          {slot.sets.map((set) => (
            <Text key={set.set_number} style={{ color: palette.ink }}>
              Set {set.set_number}: {set.weight?.value ?? '—'} {set.weight?.unit ?? unit} ·{' '}
              {set.reps ?? '—'} reps
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
