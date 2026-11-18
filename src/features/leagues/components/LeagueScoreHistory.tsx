import { useInfiniteQuery } from '@tanstack/react-query';
import React from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { screenContentStyle } from '@/components/ScreenHeader';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { leaguesApi } from '../api';
import type { StandingRow } from '../schemas';
import { LeaguePageHeader } from './LeaguePageHeader';
import { LeagueAction, LeagueCard, leagueStyles } from './LeagueUI';

export function roundRange(start: string, end: string, timezone: string) {
  const format = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  });
  // End is exclusive at local midnight. Display the last included calendar day.
  return `${format.format(new Date(start))} – ${format.format(new Date(Date.parse(end) - 1))}`;
}

export function durationHours(microseconds: string) {
  const thousandths = (BigInt(microseconds) + 1800000n) / 3600000n;
  return `${thousandths / 1000n}.${String(thousandths % 1000n).padStart(3, '0')}`;
}

export function LeagueScoreHistory({
  accountId,
  leagueId,
  member,
  timezone,
  active,
  onBack,
}: Readonly<{
  accountId: number;
  leagueId: number;
  member: StandingRow;
  timezone: string;
  active: boolean;
  onBack: () => void;
}>) {
  const p = usePalette();
  const name = member.display_name ?? 'Member';
  const history = useInfiniteQuery({
    queryKey: ['leagues', accountId, leagueId, 'score-history', member.user_id],
    enabled: active,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      leaguesApi.scoreHistory(leagueId, member.user_id, pageParam, signal),
    getNextPageParam: (page) => page.next_before ?? undefined,
  });
  const following = () => {
    void history.fetchNextPage({ cancelRefetch: false });
  };
  function renderPagination() {
    if (history.isFetchingNextPage)
      return <ActivityIndicator color={p.brand} accessibilityLabel="Loading more scores" />;
    if (history.isFetchNextPageError)
      return <LeagueAction label="Retry more scores" onPress={following} />;
    return null;
  }

  return (
    <FlatList
      contentContainerStyle={[
        screenContentStyle,
        { paddingBottom: spacing['space-8'], gap: spacing['space-3'] },
      ]}
      data={history.data?.pages.flatMap((page) => page.items) ?? []}
      keyExtractor={(item) => item.local_day}
      ListHeaderComponent={
        <View style={leagueStyles.section}>
          <LeaguePageHeader
            accountId={accountId}
            title={name}
            picture={member.picture_url}
            member
            backLabel="Back to standings"
            onBack={onBack}
          />
          <Text accessibilityRole="header" style={[textStyles['title-lg'], { color: p.ink }]}>
            Score history
          </Text>
          {history.isPending ? (
            <ActivityIndicator color={p.brand} accessibilityLabel="Loading score history" />
          ) : null}
          {history.isError && !history.data ? (
            <>
              <Text accessibilityRole="alert" style={[textStyles.body, { color: p.danger }]}>
                Could not load score history.
              </Text>
              <LeagueAction
                label="Retry score history"
                onPress={() => {
                  void history.refetch();
                }}
              />
            </>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        history.isSuccess ? (
          <Text style={[textStyles.body, { color: p['ink-muted'] }]}>No credited scores yet.</Text>
        ) : null
      }
      renderItem={({ item }) => (
        <LeagueCard>
          <View style={[leagueStyles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
            <Text style={[textStyles.label, { color: p.ink }]}>
              {roundRange(item.start_at, item.end_at, timezone)}
            </Text>
            <Text
              style={[
                textStyles['title-md'],
                { color: p['brand-ink'], fontVariant: ['tabular-nums'] },
              ]}
            >
              {item.score} points
            </Text>
          </View>
          <Text style={[textStyles.body, { color: p.ink }]}>Workout #{item.session_id}</Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            Completed{' '}
            {new Date(item.ended_at).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: timezone,
            })}
          </Text>
          {member.user_id === accountId && item.calculation ? (
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              Volume {item.calculation.volume_kg_reps} kg reps · Duration{' '}
              {durationHours(item.calculation.duration_us)} hours · Body weight{' '}
              {item.calculation.body_weight_kg} kg
            </Text>
          ) : null}
        </LeagueCard>
      )}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (history.hasNextPage && !history.isFetching && !history.isFetchNextPageError)
          following();
      }}
      ListFooterComponent={renderPagination()}
    />
  );
}
