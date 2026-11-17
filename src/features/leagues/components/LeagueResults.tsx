import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useRef } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { leaguesApi } from '../api';
import type { PendingResult } from '../schemas';

export function LeagueResults({
  accountId,
  leagueId,
}: Readonly<{ accountId: number; leagueId: number }>) {
  const p = usePalette();
  const cache = useQueryClient();
  const acknowledging = useRef(false);
  const key = ['leagues', accountId, leagueId, 'results', 'pending'];
  const query = useQuery({
    queryKey: key,
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
  if (query.isPending) return <ActivityIndicator accessibilityLabel="Loading league results" />;
  if (query.isError && !result)
    return (
      <View>
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          Could not load league results.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void query.refetch();
          }}
        >
          <Text style={{ color: p.brand }}>Retry results</Text>
        </Pressable>
      </View>
    );
  if (!result) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View
        accessibilityViewIsModal
        style={{
          flex: 1,
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.6)',
          padding: spacing['space-5'],
        }}
      >
        <ScrollView
          contentContainerStyle={{
            backgroundColor: p['surface-100'],
            padding: spacing['space-5'],
            gap: spacing['space-3'],
          }}
        >
          <Text accessibilityRole="header" style={[textStyles.heading, { color: p.ink }]}>
            Round result
          </Text>
          <Text style={{ color: p.ink }}>
            {result.start_at} – {result.end_at}
          </Text>
          <Text style={{ color: p.ink }}>
            {losers.length
              ? `Lowest score: ${losers.map((row) => row.display_name ?? 'Member').join(', ')}`
              : 'No losing outcome for this round.'}
          </Text>
          <Text accessibilityRole="header" style={{ color: p.ink }}>
            Final standings
          </Text>
          {result.standings.map((row) => (
            <Text key={row.user_id} style={{ color: p.ink }}>
              #{row.position} {row.display_name ?? 'Member'}: {row.score} points
            </Text>
          ))}
          {acknowledge.isError ? (
            <Text accessibilityRole="alert" style={{ color: p.danger }}>
              Could not acknowledge this result. Please try again.
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: acknowledge.isPending }}
            disabled={acknowledge.isPending}
            onPress={() => {
              if (acknowledging.current) return;
              acknowledging.current = true;
              acknowledge.mutate(result.id);
            }}
            style={{ backgroundColor: p.brand, padding: spacing['space-3'] }}
          >
            <Text style={{ color: p['on-brand'], textAlign: 'center' }}>
              {acknowledge.isPending ? 'Saving…' : 'Got it'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
