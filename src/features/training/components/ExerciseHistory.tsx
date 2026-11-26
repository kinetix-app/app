import { getTranslation } from '@/i18n/catalog';
import React from 'react';
import { useLanguage } from '@/i18n/Language';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';
import { spacing, usePalette } from '@/theme/tokens';
import { formatCardioDuration } from '../cardio';
import { trainingApi } from '../api';
import type { ExerciseHistoryItem } from '../schemas';
import { Button, Failure, Loading, ui } from './ui';

export function ExerciseHistory({
  accountId,
  exerciseId,
  onOpenWorkout,
}: Readonly<{
  accountId: number;
  exerciseId: number;
  onOpenWorkout: (id: number) => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
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
        <Text style={{ color: p['ink-muted'] }}>
          {getTranslation(es ? 'es' : 'en')('training.noPreviousSessionsForThisExercise_652a75')}
        </Text>
      ) : null}
      {items.map((item) => (
        <HistoryCard key={item.session_id} item={item} onOpenWorkout={onOpenWorkout} />
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
          <Text style={{ color: p.brand }}>
            {getTranslation(es ? 'es' : 'en')('training.loadMoreHistory_8923d1')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function HistoryCard({
  item,
  onOpenWorkout,
}: Readonly<{ item: ExerciseHistoryItem; onOpenWorkout: (id: number) => void }>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const sets = keyedSets(item.sets);
  return (
    <View style={[ui.card, { backgroundColor: p['surface-200'], gap: spacing['space-1'] }]}>
      <Text style={{ color: p.ink, fontWeight: '700' }}>{item.name}</Text>
      <Text style={{ color: p['ink-muted'] }}>
        {new Date(item.ended_at).toLocaleString(es ? 'es' : undefined)}
      </Text>
      {item.sets.length ? (
        sets.map(({ key, measurement }, index) => (
          <Text key={key} style={{ color: p.ink }}>
            {index + 1} · {measurement}
          </Text>
        ))
      ) : (
        <Text style={{ color: p['ink-muted'] }}>
          {getTranslation(es ? 'es' : 'en')('training.noSetsRecorded_ab2cd2')}
        </Text>
      )}
      <Button
        title={getTranslation(es ? 'es' : 'en')('training.viewWorkout_79f257')}
        secondary
        accessibilityLabel={getTranslation(es ? 'es' : 'en')('dynamicMessages.viewWorkout_d0de35', {
          value1: item.session_id,
        })}
        onPress={() => onOpenWorkout(item.session_id)}
      />
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

function keyedSets(sets: ExerciseHistoryItem['sets']) {
  // History groups repeated exercise occurrences; set numbers are not unique,
  // and the API exposes no set IDs. Distinguish identical immutable rows by occurrence.
  const occurrences = new Map<string, number>();
  return sets.map((set) => {
    const identity = JSON.stringify(set);
    const occurrence = (occurrences.get(identity) ?? 0) + 1;
    occurrences.set(identity, occurrence);
    return { key: `${identity}:${occurrence}`, measurement: formatSet(set) };
  });
}
