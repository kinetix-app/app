import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { AnimatedTextSelector } from '@/components/AnimatedTextSelector';
import { screenContentStyle } from '@/components/ScreenHeader';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { ApiError } from '@/services/apiClient';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { leaguesApi } from '../api';
import type { LeagueContribution, StandingRow } from '../schemas';
import { LeagueContributionRow } from './LeagueContributionRow';
import { LeagueRoundPicker, type RoundSelection } from './LeagueRoundPicker';
import { LeagueScoreHistory, roundRange } from './LeagueScoreHistory';
import { LeagueAction, LeagueRankingRow, leagueStyles } from './LeagueUI';

export function LeagueStandings({
  accountId,
  leagueId,
  header,
  active = true,
  onBack,
}: Readonly<{
  accountId: number;
  leagueId: number;
  header?: React.ReactNode;
  active?: boolean;
  onBack?: () => void;
}>) {
  const p = usePalette();
  const [view, setView] = useState<'rankings' | 'breakdown'>('rankings');
  const [period, setPeriod] = useState<'round' | 'general'>('round');
  const [roundSelection, setRoundSelection] = useState<RoundSelection>('current');
  const [member, setMember] = useState<StandingRow | null>(null);
  const rounds = useQuery({
    queryKey: ['leagues', accountId, leagueId, 'rounds'],
    queryFn: ({ signal }) => leaguesApi.rounds(leagueId, signal),
    enabled: active,
  });
  const selectedRoundId =
    roundSelection === 'current' ? rounds.data?.current_round_id : roundSelection;
  const roundId = period === 'general' ? null : selectedRoundId;
  const rankings = useInfiniteQuery({
    queryKey: ['leagues', accountId, leagueId, 'rankings', roundId],
    initialPageParam: 0,
    enabled: active && view === 'rankings' && roundId !== undefined && rounds.isSuccess,
    queryFn: ({ pageParam, signal }) =>
      leaguesApi.standingsPage(leagueId, roundId ?? null, pageParam, signal),
    getNextPageParam: (page) => page.next_offset ?? undefined,
  });
  const contributions = useInfiniteQuery({
    queryKey: ['leagues', accountId, leagueId, 'contributions', roundId],
    initialPageParam: 0,
    enabled: active && view === 'breakdown' && roundId !== undefined && rounds.isSuccess,
    queryFn: ({ pageParam, signal }) =>
      leaguesApi.contributions(leagueId, roundId ?? null, pageParam, signal),
    getNextPageParam: (page) => page.next_offset ?? undefined,
  });
  useHardwareBack(() => {
    if (member) {
      setMember(null);
      return true;
    }
    if (!onBack) return false;
    onBack();
    return true;
  }, active);
  if (member && rounds.data) {
    return (
      <LeagueScoreHistory
        accountId={accountId}
        leagueId={leagueId}
        member={member}
        timezone={rounds.data.timezone}
        active={active}
        onBack={() => setMember(null)}
      />
    );
  }
  const options: { value: RoundSelection; label: string; detail?: string }[] = [];
  if (rounds.data) {
    const { timezone, current_round_id } = rounds.data;
    const current = rounds.data.rounds.find((round) => round.id === current_round_id);
    options.push({
      value: 'current',
      label: 'Current round',
      detail: current ? roundRange(current.start_at, current.end_at, timezone) : undefined,
    });
    for (const round of rounds.data.rounds) {
      if (round.id !== current_round_id)
        options.push({
          value: round.id,
          label: roundRange(round.start_at, round.end_at, timezone),
        });
    }
  }
  const showingRankings = view === 'rankings';
  const page = showingRankings ? rankings : contributions;
  const next = () => {
    void page.fetchNextPage({ cancelRefetch: false });
  };
  const initialError = rounds.error ?? (page.data ? null : page.error);
  const rows: (StandingRow | LeagueContribution)[] = showingRankings
    ? Array.from(
        new Map(
          rankings.data?.pages
            .flatMap((page) => page.items)
            .map((row) => [row.user_id, row] as const),
        ).values(),
      )
    : Array.from(
        new Map(
          contributions.data?.pages
            .flatMap((page) => page.items)
            .map((row) => [`${row.user_id}:${row.local_day}`, row] as const),
        ).values(),
      );
  return (
    <FlatList
      key={view}
      data={rows}
      keyExtractor={(item) =>
        'position' in item ? String(item.user_id) : `${item.user_id}:${item.local_day}`
      }
      contentContainerStyle={[
        screenContentStyle,
        { paddingBottom: spacing['space-8'], gap: spacing['space-3'] },
      ]}
      ListHeaderComponent={
        <View style={leagueStyles.section}>
          {header}
          <Text accessibilityRole="header" style={[textStyles['title-lg'], { color: p.ink }]}>
            Standings
          </Text>
          {rounds.data ? (
            <>
              <View
                accessibilityRole="tablist"
                accessibilityLabel="Standings period"
                style={{
                  flexDirection: 'row',
                  borderRadius: radii['radius-md'],
                  backgroundColor: p['surface-200'],
                  overflow: 'hidden',
                }}
              >
                <AnimatedTextSelector
                  role="tab"
                  label="Round"
                  selected={period === 'round'}
                  reduceMotion
                  equalWidth
                  onPress={() => setPeriod('round')}
                />
                <AnimatedTextSelector
                  role="tab"
                  label="General"
                  selected={period === 'general'}
                  reduceMotion
                  equalWidth
                  onPress={() => setPeriod('general')}
                />
              </View>
              {period === 'round' ? (
                <LeagueRoundPicker
                  selection={roundSelection}
                  options={options}
                  onSelect={setRoundSelection}
                />
              ) : null}
              <View
                accessibilityRole="tablist"
                accessibilityLabel="Standings views"
                style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: p.line }}
              >
                <AnimatedTextSelector
                  role="tab"
                  label="Rankings"
                  selected={showingRankings}
                  reduceMotion
                  equalWidth
                  onPress={() => setView('rankings')}
                />
                <AnimatedTextSelector
                  role="tab"
                  label="Points breakdown"
                  selected={!showingRankings}
                  reduceMotion
                  equalWidth
                  onPress={() => setView('breakdown')}
                />
              </View>
            </>
          ) : null}
          {initialError ? (
            <>
              <Text accessibilityRole="alert" style={[textStyles.body, { color: p.danger }]}>
                {initialError instanceof ApiError && initialError.status === 409
                  ? 'Standings are unavailable because this older league has no calendar.'
                  : showingRankings
                    ? 'Could not load standings.'
                    : 'Could not load the points breakdown.'}
              </Text>
              <LeagueAction
                label={showingRankings ? 'Retry standings' : 'Retry points breakdown'}
                onPress={() => {
                  void (rounds.isError ? rounds.refetch() : page.refetch());
                }}
              />
            </>
          ) : page.isPending ? (
            <ActivityIndicator
              color={p.brand}
              accessibilityLabel={
                showingRankings ? 'Loading standings' : 'Loading points breakdown'
              }
            />
          ) : null}
        </View>
      }
      ListEmptyComponent={
        page.isSuccess ? (
          <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
            {showingRankings ? 'No standings yet.' : 'No credited workouts in this period.'}
          </Text>
        ) : null
      }
      renderItem={({ item }) =>
        'position' in item ? (
          <LeagueRankingRow
            row={item}
            accountId={accountId}
            current={item.user_id === accountId}
            onPress={() => setMember(item)}
          />
        ) : (
          <LeagueContributionRow
            item={item}
            accountId={accountId}
            timezone={rounds.data?.timezone ?? 'UTC'}
          />
        )
      }
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (active && page.hasNextPage && !page.isFetching && !page.isFetchNextPageError) next();
      }}
      ListFooterComponent={
        page.isFetchingNextPage ? (
          <ActivityIndicator
            color={p.brand}
            accessibilityLabel={
              showingRankings ? 'Loading more standings' : 'Loading more contributions'
            }
          />
        ) : page.isFetchNextPageError ? (
          <LeagueAction
            label={showingRankings ? 'Retry more standings' : 'Retry more contributions'}
            onPress={next}
          />
        ) : null
      }
    />
  );
}
