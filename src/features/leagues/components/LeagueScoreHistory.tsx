import { getTranslation } from '@/i18n/catalog';
import { useLanguage } from '@/i18n/Language';
import { useInfiniteQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { screenContentStyle } from '@/components/ScreenHeader';
import { SessionWorkoutDetailModal } from '@/features/training/components/SessionWorkoutDetail';
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
  const language = useLanguage();

  const p = usePalette();
  const name = member.display_name ?? getTranslation(language)('socialAdditional.member_10100e');
  const backTitle = getTranslation(language)(
    backTo === 'Standings'
      ? 'socialAdditional.standingsBackTitle'
      : 'socialAdditional.informationBackTitle',
  );
  const backAction = getTranslation(language)(
    backTo === 'Standings'
      ? 'socialAdditional.standingsBackAction'
      : 'socialAdditional.informationBackAction',
  );
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
      return (
        <ActivityIndicator
          color={p.brand}
          accessibilityLabel={getTranslation(language)('socialAdditional.loadingMoreScores_97cdfb')}
        />
      );
    if (history.isFetchNextPageError)
      return (
        <LeagueAction
          label={getTranslation(language)('socialAdditional.retryMoreScores_31f8a3')}
          onPress={following}
        />
      );
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
              navigationLabel={backTitle}
              backLabel={backAction}
              onBack={onBack}
            />
            <Text accessibilityRole="header" style={[textStyles['title-lg'], { color: p.ink }]}>
              {getTranslation(language)('socialAdditional.scoreHistory_556af1')}
            </Text>
            {history.isPending ? (
              <ActivityIndicator
                color={p.brand}
                accessibilityLabel={getTranslation(language)(
                  'socialAdditional.loadingScoreHistory_4c67b5',
                )}
              />
            ) : null}
            {history.isError && !history.data ? (
              <>
                <Text accessibilityRole="alert" style={[textStyles.body, { color: p.danger }]}>
                  {getTranslation(language)('socialAdditional.couldNotLoadScoreHistory_c1012b')}
                </Text>
                <LeagueAction
                  label={getTranslation(language)('socialAdditional.retryScoreHistory_a5facd')}
                  onPress={() => {
                    void history.refetch();
                  }}
                />
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          (history.isSuccess ? (
            <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
              {getTranslation(language)('socialAdditional.noCreditedScoresYet_fcf5d9')}
            </Text>
          ) : null) ?? undefined
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
        ListFooterComponent={renderPagination() ?? undefined}
      />
      {active && ownHistory && workoutId !== null ? (
        <SessionWorkoutDetailModal
          accountId={accountId}
          sessionId={workoutId}
          backLabel={getTranslation(language)('socialAdditional.backToScoreHistory_a3ed5e')}
          onBack={() => setWorkoutId(null)}
        />
      ) : null}
    </>
  );
}
