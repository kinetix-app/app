import { getTranslation } from '@/i18n/catalog';
import { useInfiniteQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { useLanguage } from '@/i18n/Language';
import { trainingApi } from '../api';
import { Failure, IconButton, Loading, ui } from './ui';
import { SessionWorkoutDetailModal } from './SessionWorkoutDetail';
import { WorkoutSummaryCard } from './WorkoutSummaryCard';

export function WorkoutHistory({
  accountId,
  onClose,
  backLabel,
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
  const es = useLanguage() === 'es';
  const locale = es ? 'es' : undefined;
  const monthFormat = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const dayFormat = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
  const unit = 'kg';
  const [selected, setSelected] = useState<number | null>(null);
  const detailOpen = active && selected !== null;
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
  let listHeader = null;
  if (list.isPending) listHeader = <Loading />;
  else if (list.isError && !list.isFetchNextPageError)
    listHeader = <Failure error={list.error} retry={() => void list.refetch()} />;
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
        aria-hidden={detailOpen}
        accessibilityElementsHidden={detailOpen}
        importantForAccessibility={detailOpen ? 'no-hide-descendants' : 'auto'}
        style={[styles.header, { borderColor: p.line }]}
      >
        <View style={[ui.row, styles.headerContent]}>
          <IconButton
            icon="arrow-left"
            label={backLabel ?? getTranslation(es ? 'es' : 'en')('training.backToRoutines_ca811d')}
            onPress={onClose}
          />
          <Text accessibilityRole="header" style={[ui.heading, { color: p.ink, flex: 1 }]}>
            {getTranslation(es ? 'es' : 'en')('training.workoutHistory_ca0ae9')}
          </Text>
        </View>
      </View>
      <FlatList
        aria-hidden={detailOpen}
        accessibilityElementsHidden={detailOpen}
        importantForAccessibility={detailOpen ? 'no-hide-descendants' : 'auto'}
        contentContainerStyle={[ui.content, styles.list]}
        data={sessions}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={listHeader ?? undefined}
        ListEmptyComponent={
          (!list.isPending && !list.isError ? (
            <Text style={{ color: p['ink-muted'] }}>
              {getTranslation(es ? 'es' : 'en')('training.noCompletedWorkoutsYet_0b37be')}
            </Text>
          ) : null) ?? undefined
        }
        renderItem={({ item, index }) => {
          const completed = new Date(item.ended_at);
          const month = monthFormat.format(completed);
          const previous = sessions[index - 1];
          const startsMonth =
            !previous || month !== monthFormat.format(new Date(previous.ended_at));
          const day = dayFormat.format(completed);
          const time = timeFormat.format(completed);
          const when = getTranslation(es ? 'es' : 'en')('dynamicMessages.at_a18fb4', {
            value1: day,
            value2: time,
          });
          const seconds = Math.max(
            0,
            Math.floor((completed.getTime() - Date.parse(item.started_at)) / 1000),
          );
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
                title={item.title}
                subtitle={`${day} · ${time}`}
                durationSeconds={seconds}
                volumeKg={item.total_volume_kg}
                exerciseCount={item.exercises.length}
                open={{
                  label: getTranslation(es ? 'es' : 'en')('dynamicMessages.viewFrom_44e9bf', {
                    value1: item.title,
                    value2: when,
                  }),
                  onPress: () => setSelected(item.id),
                }}
              />
            </View>
          );
        }}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetching && !list.isFetchNextPageError)
            void list.fetchNextPage({ cancelRefetch: false });
        }}
        ListFooterComponent={footer ?? undefined}
      />
      {detailOpen ? (
        <SessionWorkoutDetailModal
          accountId={accountId}
          sessionId={selected}
          backLabel={getTranslation(es ? 'es' : 'en')('training.backToHistory_8fcd2b')}
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
