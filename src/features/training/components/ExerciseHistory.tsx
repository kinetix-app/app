import React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';
import { spacing, usePalette } from '@/theme/tokens';
import { formatCardioDuration } from '../cardio';
import { trainingApi } from '../api';
import type { ExerciseHistoryItem } from '../schemas';
import { Failure, Loading, ui } from './ui';

export function ExerciseHistory({
  accountId,
  exerciseId,
}: Readonly<{ accountId: number; exerciseId: number }>) {
  const p = usePalette();
  const history = useInfiniteQuery({
    queryKey: ['training', accountId, 'exercise-history', exerciseId, 'kg'],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => trainingApi.exerciseHistory(exerciseId, pageParam, signal),
    getNextPageParam: (page) =>
      page.items.length === page.limit ? page.offset + page.limit : undefined,
  });
  if (history.isPending) return <Loading />;
  if (history.isError && !history.data)
    return <Failure error={history.error} retry={() => void history.refetch()} />;
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <View style={ui.gap}>
      {items.length === 0 ? (
        <Text style={{ color: p['ink-muted'] }}>No previous sessions for this exercise.</Text>
      ) : null}
      {items.map((item) => (
        <HistoryCard key={item.session_id} item={item} />
      ))}
      {history.isFetchNextPageError ? (
        <Failure error={history.error} retry={() => void history.fetchNextPage()} />
      ) : null}
      {history.isFetchingNextPage ? <Loading /> : null}
      {history.hasNextPage && !history.isFetchingNextPage && !history.isFetchNextPageError ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void history.fetchNextPage()}
          style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={{ color: p.brand }}>Load more history</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function HistoryCard({ item }: Readonly<{ item: ExerciseHistoryItem }>) {
  const p = usePalette();
  return (
    <View style={[ui.card, { backgroundColor: p['surface-200'], gap: spacing['space-1'] }]}>
      <Text style={{ color: p.ink, fontWeight: '700' }}>{item.name}</Text>
      <Text style={{ color: p['ink-muted'] }}>{new Date(item.ended_at).toLocaleString()}</Text>
      {item.sets.length ? (
        item.sets.map((set, index) => (
          <Text key={index} style={{ color: p.ink }}>
            {index + 1} · {formatSet(set)}
          </Text>
        ))
      ) : (
        <Text style={{ color: p['ink-muted'] }}>No sets recorded.</Text>
      )}
    </View>
  );
}

function formatSet(set: ExerciseHistoryItem['sets'][number]) {
  const values: string[] = [];
  if (set.reps !== null) values.push(`${set.reps} reps`);
  if (set.weight) values.push(`${set.weight.value} ${set.weight.unit}`);
  else if (set.weight_kg !== null) values.push(`${set.weight_kg} kg`);
  if (set.distance_km !== null) values.push(`${set.distance_km} km`);
  if (set.duration_seconds !== null) {
    values.push(formatCardioDuration(set.duration_seconds));
  }
  return values.join(' · ') || 'No measurements';
}
