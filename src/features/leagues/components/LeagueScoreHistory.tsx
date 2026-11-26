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
  const t = (en: string, es: string) => (language === 'es' ? es : en);
  const p = usePalette();
  const name = member.display_name ?? t('Member', 'Miembro');
  let backTitle: string = backTo;
  let backAction: string = `Back to ${backTo.toLowerCase()}`;
  if (language === 'es') {
    if (backTo === 'Standings') {
      backTitle = 'Clasificación';
      backAction = 'Volver a clasificación';
    } else {
      backTitle = 'Información de la liga';
      backAction = 'Volver a información de la liga';
    }
  }
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
          accessibilityLabel={t('Loading more scores', 'Cargando más puntuaciones')}
        />
      );
    if (history.isFetchNextPageError)
      return (
        <LeagueAction
          label={t('Retry more scores', 'Reintentar más puntuaciones')}
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
              {t('Score history', 'Historial de puntos')}
            </Text>
            {history.isPending ? (
              <ActivityIndicator
                color={p.brand}
                accessibilityLabel={t('Loading score history', 'Cargando historial de puntos')}
              />
            ) : null}
            {history.isError && !history.data ? (
              <>
                <Text accessibilityRole="alert" style={[textStyles.body, { color: p.danger }]}>
                  {t('Could not load score history.', 'No se pudo cargar el historial de puntos.')}
                </Text>
                <LeagueAction
                  label={t('Retry score history', 'Reintentar historial de puntos')}
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
              {t('No credited scores yet.', 'Aún no hay puntuaciones registradas.')}
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
          backLabel={t('Back to score history', 'Volver al historial de puntos')}
          onBack={() => setWorkoutId(null)}
        />
      ) : null}
    </>
  );
}
