import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ApiError } from '@/services/apiClient';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { leaguesApi } from '../api';
import type { Standings } from '../schemas';

function durationHours(microseconds: string) {
  const thousandths = (BigInt(microseconds) + 1800000n) / 3600000n;
  return `${thousandths / 1000n}.${String(thousandths % 1000n).padStart(3, '0')}`;
}

type Round = Standings['rounds'][number];

export function StandingsContent({
  data,
  accountId,
}: Readonly<{ data: Standings; accountId: number }>) {
  const p = usePalette();
  const [selection, setSelection] = useState<'general' | number>(data.current_round_id);
  const round = data.rounds.find((item) => item.id === selection);
  const rows = selection === 'general' ? data.general : (round?.standings ?? []);
  const select = (label: string, value: 'general' | number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: selection === value }}
      onPress={() => setSelection(value)}
      style={{
        padding: spacing['space-2'],
        borderWidth: 1,
        borderColor: selection === value ? p.brand : p.line,
      }}
    >
      <Text style={{ color: p.ink }}>{label}</Text>
    </Pressable>
  );
  const label = (item: Round) =>
    item.id === data.current_round_id
      ? 'Current round'
      : `Past round: ${item.start_at} – ${item.end_at}`;
  return (
    <View style={{ gap: spacing['space-2'] }}>
      <Text accessibilityRole="header" style={[textStyles.heading, { color: p.ink }]}>
        Standings
      </Text>
      <Text style={{ color: p['ink-muted'] }}>Timezone: {data.timezone}</Text>
      {select('General standings', 'general')}
      {data.rounds.map((item) => (
        <React.Fragment key={item.id}>{select(label(item), item.id)}</React.Fragment>
      ))}
      <Text accessibilityRole="header" style={{ color: p.ink }}>
        {selection === 'general' ? 'General standings' : round ? label(round) : 'Round unavailable'}
      </Text>
      {rows.length ? (
        rows.map((row) => (
          <Text key={row.user_id} style={{ color: p.ink }}>
            #{row.position} {row.display_name ?? 'Member'}: {row.score} points
          </Text>
        ))
      ) : (
        <Text style={{ color: p.ink }}>No standings yet.</Text>
      )}
      {round ? (
        <>
          <Text accessibilityRole="header" style={{ color: p.ink }}>
            Daily contributions
          </Text>
          {round.contributions.length ? (
            round.contributions.map((entry) => {
              const member = round.standings.find((row) => row.user_id === entry.user_id);
              return (
                <View key={`${entry.user_id}-${entry.local_day}`}>
                  <Text style={{ color: p.ink }}>
                    {entry.local_day} · {member?.display_name ?? 'Member'}: {entry.score} points
                  </Text>
                  {entry.user_id === accountId && entry.calculation ? (
                    <Text style={{ color: p['ink-muted'] }}>
                      Workout {entry.calculation.session_id} · Volume{' '}
                      {entry.calculation.volume_kg_reps} kg reps · Duration{' '}
                      {durationHours(entry.calculation.duration_us)} hours · Body weight{' '}
                      {entry.calculation.body_weight_kg} kg
                    </Text>
                  ) : null}
                </View>
              );
            })
          ) : (
            <Text style={{ color: p.ink }}>No daily contributions yet.</Text>
          )}
        </>
      ) : null}
    </View>
  );
}

export function LeagueStandings({
  accountId,
  leagueId,
}: Readonly<{ accountId: number; leagueId: number }>) {
  const p = usePalette();
  const query = useQuery({
    queryKey: ['leagues', accountId, leagueId, 'standings'],
    queryFn: ({ signal }) => leaguesApi.standings(leagueId, signal),
  });
  if (query.isPending) return <ActivityIndicator accessibilityLabel="Loading standings" />;
  if (query.isError)
    return (
      <View style={{ gap: spacing['space-2'] }}>
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          {query.error instanceof ApiError && query.error.status === 409
            ? 'Standings are unavailable because this older league has no calendar.'
            : 'Could not load standings.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void query.refetch();
          }}
        >
          <Text style={{ color: p.brand }}>Retry standings</Text>
        </Pressable>
      </View>
    );
  return <StandingsContent data={query.data} accountId={accountId} />;
}
