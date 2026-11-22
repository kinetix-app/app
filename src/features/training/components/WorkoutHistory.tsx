import { useInfiniteQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { trainingApi } from '../api';
import { formatElapsedDuration } from '../workoutFormat';
import { Failure, IconButton, Loading, ui } from './ui';
import { WorkoutPreviewModal } from './WorkoutPreview';
import { WorkoutSummaryCard } from './WorkoutSummaryCard';

const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function WorkoutHistory({
  accountId,
  onClose,
  backLabel = 'Back to routines',
  active = true,
  onShare,
}: Readonly<{
  accountId: number;
  onClose: () => void;
  backLabel?: string;
  active?: boolean;
  /** Opens the feed composer with this completed workout selected. */
  onShare?: (sessionId: number) => void;
}>) {
  const p = usePalette();
  const unit = 'kg';
  const [selected, setSelected] = useState<number | null>(null);
  const previewOpen = active && selected !== null;
  const list = useInfiniteQuery({
    queryKey: ['training', accountId, 'sessions', unit],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => trainingApi.sessions(pageParam, unit, signal),
    getNextPageParam: (page) =>
      page.items.length === page.limit ? page.offset + page.limit : undefined,
  });
  const sessions = list.data?.pages.flatMap((page) => page.items) ?? [];
  let footer = null;
  if (list.isFetchingNextPage) footer = <Loading />;
  else if (list.isFetchNextPageError)
    footer = (
      <Failure error={list.error} retry={() => void list.fetchNextPage({ cancelRefetch: false })} />
    );
  useHardwareBack(
    () => {
      onClose();
      return true;
    },
    active && selected === null,
  );

  function shareSelected(sessionId: number) {
    setSelected(null);
    onShare?.(sessionId);
  }

  return (
    <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
      <View
        aria-hidden={previewOpen}
        accessibilityElementsHidden={previewOpen}
        importantForAccessibility={previewOpen ? 'no-hide-descendants' : 'auto'}
        style={[styles.header, { borderColor: p.line }]}
      >
        <View style={[ui.row, styles.headerContent]}>
          <IconButton icon="arrow-left" label={backLabel} onPress={onClose} />
          <Text accessibilityRole="header" style={[ui.heading, { color: p.ink, flex: 1 }]}>
            Workout history
          </Text>
        </View>
      </View>
      <FlatList
        aria-hidden={previewOpen}
        accessibilityElementsHidden={previewOpen}
        importantForAccessibility={previewOpen ? 'no-hide-descendants' : 'auto'}
        contentContainerStyle={[ui.content, styles.list]}
        data={sessions}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          list.isPending ? (
            <Loading />
          ) : list.isError && !list.isFetchNextPageError ? (
            <Failure error={list.error} retry={() => void list.refetch()} />
          ) : null
        }
        ListEmptyComponent={
          !list.isPending && !list.isError ? (
            <Text style={{ color: p['ink-muted'] }}>No completed workouts yet.</Text>
          ) : null
        }
        renderItem={({ item, index }) => {
          const completed = new Date(item.ended_at);
          const month = monthFormat.format(completed);
          const previous = sessions[index - 1];
          const startsMonth =
            !previous || month !== monthFormat.format(new Date(previous.ended_at));
          const day = dayFormat.format(completed);
          const time = timeFormat.format(completed);
          const when = `${day} at ${time}`;
          const seconds = Math.max(
            0,
            Math.floor((completed.getTime() - Date.parse(item.started_at)) / 1000),
          );
          const sets = item.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
          return (
            <View style={styles.item}>
              {startsMonth ? (
                <Text
                  accessibilityRole="header"
                  style={[textStyles['title-md'], { color: p.ink }, index > 0 && styles.nextMonth]}
                >
                  {month}
                </Text>
              ) : null}
              <WorkoutSummaryCard
                testID={`history-workout-${item.id}`}
                title={day}
                subtitle={time}
                metrics={[
                  { label: 'Duration', value: formatElapsedDuration(seconds) },
                  { label: 'Exercises', value: item.exercises.length.toLocaleString() },
                  { label: 'Sets', value: sets.toLocaleString() },
                ]}
                exerciseNames={item.exercises.map(({ exercise }) => exercise.name)}
                open={{ label: `View workout from ${when}`, onPress: () => setSelected(item.id) }}
                share={
                  onShare
                    ? {
                        label: `Share workout from ${when} to feed`,
                        onPress: () => onShare(item.id),
                      }
                    : undefined
                }
              />
            </View>
          );
        }}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetching && !list.isFetchNextPageError)
            void list.fetchNextPage({ cancelRefetch: false });
        }}
        ListFooterComponent={footer}
      />
      {previewOpen ? (
        <WorkoutPreviewModal
          accountId={accountId}
          sessionId={selected}
          backLabel="Back to history"
          onBack={() => setSelected(null)}
          showShare={Boolean(onShare)}
          onShare={shareSelected}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { borderBottomWidth: StyleSheet.hairlineWidth },
  headerContent: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: spacing['space-4'],
    paddingVertical: spacing['space-3'],
  },
  list: { gap: spacing['space-3'] },
  item: { gap: spacing['space-3'] },
  nextMonth: { marginTop: spacing['space-2'] },
});
