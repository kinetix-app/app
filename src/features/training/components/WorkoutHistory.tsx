import { Feather } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { trainingApi } from '../api';
import { Failure, IconButton, Loading, ui } from './ui';
import { WorkoutPreviewModal } from './WorkoutPreview';

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
      <FlatList
        aria-hidden={previewOpen}
        accessibilityElementsHidden={previewOpen}
        importantForAccessibility={previewOpen ? 'no-hide-descendants' : 'auto'}
        contentContainerStyle={ui.content}
        data={list.data?.pages.flatMap((page) => page.items) ?? []}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View style={ui.gap}>
            <View style={ui.row}>
              <IconButton icon="arrow-left" label={backLabel} onPress={onClose} />
              <Text accessibilityRole="header" style={[ui.heading, { color: p.ink, flex: 1 }]}>
                Workout history
              </Text>
            </View>
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
        renderItem={({ item }) => {
          const completed = new Date(item.ended_at);
          const date = completed.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          const time = completed.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          });
          const count = item.exercises.length;
          const firstExercise = item.exercises[0]?.exercise.name;
          return (
            <View style={[ui.row, styles.card, { backgroundColor: p['surface-200'] }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View workout ${item.id}`}
                accessibilityHint={`${date}, ${time}. ${count} ${count === 1 ? 'exercise' : 'exercises'}.`}
                onPress={() => setSelected(item.id)}
                style={({ pressed }) => [ui.row, styles.entry, { opacity: pressed ? 0.65 : 1 }]}
              >
                <View style={styles.entryText}>
                  <Text style={[textStyles['title-md'], { color: p.ink }]}>{date}</Text>
                  <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                    {time} · {count} {count === 1 ? 'exercise' : 'exercises'}
                  </Text>
                  {firstExercise ? (
                    <Text numberOfLines={1} style={[textStyles.body, { color: p.ink }]}>
                      {firstExercise}
                      {count > 1 ? ` +${count - 1} more` : ''}
                    </Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={20} color={p['ink-muted']} />
              </Pressable>
              {onShare ? (
                <IconButton
                  icon="share"
                  label={`Share workout ${item.id} to feed`}
                  onPress={() => onShare(item.id)}
                />
              ) : null}
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
  card: {
    borderRadius: radii['radius-lg'],
    paddingHorizontal: spacing['space-4'],
  },
  entry: {
    flex: 1,
    minHeight: sizes['tap-min'],
    minWidth: 0,
    paddingVertical: spacing['space-3'],
  },
  entryText: { flex: 1, minWidth: 0, gap: spacing['space-1'] },
});
