import { getTranslation } from '@/i18n/catalog';
import { useLanguage } from '@/i18n/Language';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useRef } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, View } from 'react-native';
import { radii, shadows, spacing, textStyles, usePalette } from '@/theme/tokens';
import { leaguesApi } from '../api';
import { LeagueAction, LeagueRankingRow } from './LeagueUI';
import type { PendingResult } from '../schemas';

export function LeagueResults({
  accountId,
  leagueId,
  active = true,
  timezone,
}: Readonly<{ accountId: number; leagueId: number; active?: boolean; timezone?: string | null }>) {
  const language = useLanguage();

  const p = usePalette();
  const cache = useQueryClient();
  const acknowledging = useRef(false);
  const key = ['leagues', accountId, leagueId, 'results', 'pending'];
  const query = useQuery({
    queryKey: key,
    enabled: active,
    queryFn: ({ signal }) => leaguesApi.pendingResults(leagueId, signal),
  });
  const acknowledge = useMutation({
    mutationFn: (id: number) => leaguesApi.acknowledge(leagueId, id),
    onSettled: () => {
      acknowledging.current = false;
    },
    onSuccess: (_, id) => {
      cache.setQueryData<PendingResult[]>(key, (results) =>
        results?.filter((result) => result.id !== id),
      );
      void cache.invalidateQueries({ queryKey: key });
    },
  });
  const result = query.data?.[0];
  const losers =
    result?.standings.filter((row) => result.loser_user_ids.includes(row.user_id)) ?? [];
  if (!active) return null;
  if (query.isPending)
    return (
      <ActivityIndicator
        accessibilityLabel={getTranslation(language)(
          'socialAdditional.loadingLeagueResults_335f66',
        )}
      />
    );
  if (query.isError && !result)
    return (
      <View>
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          {getTranslation(language)('socialAdditional.couldNotLoadLeagueResults_df9ef3')}
        </Text>
        <LeagueAction
          label={getTranslation(language)('socialAdditional.retryResults_057782')}
          onPress={() => {
            void query.refetch();
          }}
        />
      </View>
    );
  if (!result) return null;
  const date = new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    ...(timezone ? { timeZone: timezone } : {}),
  });
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View
        accessibilityViewIsModal
        style={{
          flex: 1,
          justifyContent: 'center',
          backgroundColor: p.scrim,
          padding: spacing['space-5'],
        }}
      >
        <View
          style={{
            maxHeight: '90%',
            width: '100%',
            maxWidth: 640,
            alignSelf: 'center',
            borderRadius: radii['radius-xl'],
            overflow: 'hidden',
            backgroundColor: p['surface-200'],
            boxShadow: shadows()['shadow-pop'],
          }}
        >
          <ScrollView
            contentContainerStyle={{
              padding: spacing['space-5'],
              gap: spacing['space-3'],
            }}
          >
            <Text accessibilityRole="header" style={[textStyles['title-lg'], { color: p.ink }]}>
              {getTranslation(language)('socialAdditional.roundResult_e4c4c8')}
            </Text>
            <Text style={[textStyles.body, { color: p.ink }]}>
              {date.format(new Date(result.start_at))} – {date.format(new Date(result.end_at))}
            </Text>
            <Text style={[textStyles.body, { color: p.ink }]}>
              {losers.length
                ? `${getTranslation(language)('socialAdditional.lowestScore_833e0b')}: ${losers.map((row) => row.display_name ?? getTranslation(language)('socialAdditional.member_10100e')).join(', ')}`
                : getTranslation(language)('socialAdditional.noLosingOutcomeForThisRound_2d02c6')}
            </Text>
            <Text accessibilityRole="header" style={[textStyles.body, { color: p.ink }]}>
              {getTranslation(language)('socialAdditional.finalStandings_98dfa9')}
            </Text>
            {result.standings.map((row) => (
              <LeagueRankingRow
                accountId={accountId}
                key={row.user_id}
                row={row}
                current={row.user_id === accountId}
              />
            ))}
            {acknowledge.isError ? (
              <Text accessibilityRole="alert" style={{ color: p.danger }}>
                {getTranslation(language)(
                  'socialAdditional.couldNotAcknowledgeThisResultPlease_e9b116',
                )}
              </Text>
            ) : null}
            <LeagueAction
              label={
                acknowledge.isPending
                  ? getTranslation(language)('socialAdditional.saving_444c23')
                  : getTranslation(language)('socialAdditional.gotIt_b12e36')
              }
              variant="primary"
              disabled={acknowledge.isPending}
              onPress={() => {
                if (acknowledging.current) return;
                acknowledging.current = true;
                acknowledge.mutate(result.id);
              }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
