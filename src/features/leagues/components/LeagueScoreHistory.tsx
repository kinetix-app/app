import { useInfiniteQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { screenContentStyle } from '@/components/ScreenHeader';
import { WorkoutPreviewModal } from '@/features/training/components/WorkoutPreview';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { leaguesApi, leagueViewGcTime } from '../api';
import type { ScoreHistoryMember } from '../schemas';
import { LeagueContributionRow } from './LeagueContributionRow';
import { LeaguePageHeader } from './LeaguePageHeader';
import { LeagueAction, leagueStyles } from './LeagueUI';

export function LeagueScoreHistory({
  accountId,
  leagueId,
  member,
  timezone,
  active,
  backTo = 'Standings',
  onBack,
}: Readonly<{
  accountId: number;
  leagueId: number;
  member: ScoreHistoryMember;
  timezone: string;
  active: boolean;
  backTo?: 'Standings' | 'League information';
  onBack: () => void;
}>) {
  const p = usePalette();
  const name = member.display_name ?? 'Member';
  const [workoutId, setWorkoutId] = useState<number | null>(null);
  const ownHistory = member.user_id === accountId;
  const history = useInfiniteQuery({
    gcTime: leagueViewGcTime,
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
    <>
      <FlatList
        contentContainerStyle={[
          screenContentStyle,
          {
            paddingTop: spacing['space-3'],
            paddingBottom: spacing['space-8'],
            gap: spacing['space-3'],
          },
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
              navigationLabel={backTo}
              backLabel={`Back to ${backTo.toLowerCase()}`}
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
            <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
              No credited scores yet.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <LeagueContributionRow
            item={item}
            member={member}
            accountId={accountId}
            timezone={timezone}
            showMember={false}
            onOpenWorkout={ownHistory ? () => setWorkoutId(item.session_id) : undefined}
          />
        )}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (history.hasNextPage && !history.isFetching && !history.isFetchNextPageError)
            following();
        }}
        ListFooterComponent={renderPagination()}
      />
      {active && ownHistory && workoutId !== null ? (
        <WorkoutPreviewModal
          accountId={accountId}
          sessionId={workoutId}
          backLabel="Back to score history"
          onBack={() => setWorkoutId(null)}
        />
      ) : null}
    </>
  );
}
