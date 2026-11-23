import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { AnimatedTextSelector } from '@/components/AnimatedTextSelector';
import { screenContentStyle } from '@/components/ScreenHeader';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { ApiError } from '@/services/apiClient';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { leaguesApi, leagueViewGcTime } from '../api';
import type { LeagueContribution, ScoreHistoryMember, StandingRow } from '../schemas';
import { LeagueContributionRow } from './LeagueContributionRow';
import { LeagueRoundPicker, type RoundSelection } from './LeagueRoundPicker';
import { roundRange } from '../scoreDisplay';
import { LeagueScoreHistory } from './LeagueScoreHistory';
import { LeagueAction, LeagueRankingRow, leagueStyles } from './LeagueUI';

function roundOptions(catalog: Awaited<ReturnType<typeof leaguesApi.rounds>> | undefined) {
  const options: { value: RoundSelection; label: string; detail?: string }[] = [
    { value: null, label: 'All rounds' },
  ];
  if (catalog) {
    const { timezone, current_round_id } = catalog;
    const current = catalog.rounds.find((round) => round.id === current_round_id);
    options.push({
      value: 'current',
      label: 'Current round',
      detail: current ? roundRange(current.start_at, current.end_at, timezone) : undefined,
    });
    for (const round of catalog.rounds) {
      if (round.id !== current_round_id)
        options.push({
          value: round.id,
          label: roundRange(round.start_at, round.end_at, timezone),
        });
    }
  }
  return options;
}

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
  const [roundSelection, setRoundSelection] = useState<RoundSelection>('current');
  const [member, setMember] = useState<ScoreHistoryMember | null>(null);
  const rounds = useQuery({
    gcTime: leagueViewGcTime,
    queryKey: ['leagues', accountId, leagueId, 'rounds'],
    queryFn: ({ signal }) => leaguesApi.rounds(leagueId, signal),
    enabled: active,
  });
  const roundId = roundSelection === 'current' ? rounds.data?.current_round_id : roundSelection;
  const rankings = useInfiniteQuery({
    gcTime: leagueViewGcTime,
    queryKey: ['leagues', accountId, leagueId, 'rankings', roundId],
    initialPageParam: 0,
    enabled: active && view === 'rankings' && roundId !== undefined && rounds.isSuccess,
    queryFn: ({ pageParam, signal }) =>
      leaguesApi.standingsPage(leagueId, roundId ?? null, pageParam, signal),
    getNextPageParam: (page) => page.next_offset ?? undefined,
  });
  const contributions = useInfiniteQuery({
    gcTime: leagueViewGcTime,
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
  const options = roundOptions(rounds.data);
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
  function renderPagination() {
    if (page.isFetchingNextPage)
      return (
        <ActivityIndicator
          color={p.brand}
          accessibilityLabel={
            showingRankings ? 'Loading more standings' : 'Loading more contributions'
          }
        />
      );
    if (page.isFetchNextPageError)
      return (
        <LeagueAction
          label={showingRankings ? 'Retry more standings' : 'Retry more contributions'}
          onPress={next}
        />
      );
    return null;
  }

  function renderStatus() {
    const loadError = showingRankings
      ? 'Could not load standings.'
      : 'Could not load the points breakdown.';
    if (initialError)
      return (
        <>
          <Text accessibilityRole="alert" style={[textStyles.body, { color: p.danger }]}>
            {initialError instanceof ApiError && initialError.status === 409
              ? 'Standings are unavailable because this older league has no calendar.'
              : loadError}
          </Text>
          <LeagueAction
            label={showingRankings ? 'Retry standings' : 'Retry points breakdown'}
            onPress={() => (rounds.isError ? rounds.refetch() : page.refetch())}
          />
        </>
      );
    if (page.isPending)
      return (
        <ActivityIndicator
          color={p.brand}
          accessibilityLabel={showingRankings ? 'Loading standings' : 'Loading points breakdown'}
        />
      );
    return null;
  }

  return (
    <FlatList
      key={view}
      data={rows}
      keyExtractor={(item) =>
        'position' in item ? String(item.user_id) : `${item.user_id}:${item.local_day}`
      }
      contentContainerStyle={[
        screenContentStyle,
        {
          paddingTop: spacing['space-3'],
          paddingBottom: spacing['space-8'],
          gap: spacing['space-3'],
        },
      ]}
      ListHeaderComponent={
        <View style={leagueStyles.section}>
          {header}
          <Text accessibilityRole="header" style={[textStyles['title-lg'], { color: p.ink }]}>
            Standings
          </Text>
          {rounds.data ? (
            <>
              <LeagueRoundPicker
                selection={roundSelection}
                options={options}
                onSelect={setRoundSelection}
              />
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
          {renderStatus()}
        </View>
      }
      ListEmptyComponent={
        (page.isSuccess ? (
          <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
            {showingRankings ? 'No standings yet.' : 'No credited workouts in this period.'}
          </Text>
        ) : null) ?? undefined
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
            member={item}
            onOpen={() => setMember(item)}
            accountId={accountId}
            timezone={rounds.data?.timezone ?? 'UTC'}
          />
        )
      }
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (active && page.hasNextPage && !page.isFetching && !page.isFetchNextPageError) next();
      }}
      ListFooterComponent={renderPagination() ?? undefined}
    />
  );
}
