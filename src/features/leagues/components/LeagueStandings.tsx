import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { ApiError } from '@/services/apiClient';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { leaguesApi } from '../api';
import { LeagueAction, LeagueCard, LeagueRankingRow } from './LeagueUI';
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
        minHeight: sizes['tap-min'],
        justifyContent: 'center',
        paddingHorizontal: spacing['space-4'],
        paddingVertical: spacing['space-2'],
        borderRadius: radii['radius-pill'],
        backgroundColor: selection === value ? p['brand-soft'] : p['surface-300'],
        borderWidth: 1,
        borderColor: selection === value ? p.brand : p['line-strong'],
      }}
    >
      <Text style={[textStyles.label, { color: selection === value ? p['brand-ink'] : p.ink }]}>
        {label}
      </Text>
    </Pressable>
  );
  const date = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
      timeZone: data.timezone,
      month: 'short',
      day: 'numeric',
    });
  const label = (item: Round) =>
    item.id === data.current_round_id
      ? 'Current round'
      : `Past round: ${date(item.start_at)} – ${date(item.end_at)}`;
  return (
    <LeagueCard>
      <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
        Standings
      </Text>
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        Timezone: {data.timezone}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing['space-2'] }}
      >
        {select('General standings', 'general')}
        {data.rounds.map((item) => (
          <React.Fragment key={item.id}>{select(label(item), item.id)}</React.Fragment>
        ))}
      </ScrollView>
      <Text accessibilityRole="header" style={[textStyles.label, { color: p.ink }]}>
        {selection === 'general' ? 'General standings' : round ? label(round) : 'Round unavailable'}
      </Text>
      {rows.length ? (
        rows.map((row) => (
          <LeagueRankingRow key={row.user_id} row={row} current={row.user_id === accountId} />
        ))
      ) : (
        <Text style={[textStyles.body, { color: p.ink }]}>No standings yet.</Text>
      )}
      {round ? (
        <>
          <Text accessibilityRole="header" style={[textStyles.label, { color: p.ink }]}>
            Daily contributions
          </Text>
          {round.contributions.length ? (
            round.contributions.map((entry) => {
              const member = round.standings.find((row) => row.user_id === entry.user_id);
              return (
                <View
                  key={`${entry.user_id}-${entry.local_day}`}
                  style={{
                    gap: spacing['space-2'],
                    borderTopWidth: 1,
                    borderColor: p.line,
                    paddingTop: spacing['space-3'],
                  }}
                >
                  <Text style={[textStyles.body, { color: p.ink }]}>
                    {entry.local_day} · {member?.display_name ?? 'Member'}: {entry.score} points
                  </Text>
                  {entry.user_id === accountId && entry.calculation ? (
                    <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
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
            <Text style={[textStyles.body, { color: p.ink }]}>No daily contributions yet.</Text>
          )}
        </>
      ) : null}
    </LeagueCard>
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
        <LeagueAction
          label="Retry standings"
          onPress={() => {
            void query.refetch();
          }}
        />
      </View>
    );
  return <StandingsContent data={query.data} accountId={accountId} />;
}
