import React from 'react';
import { Text, View } from 'react-native';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import type { LeagueContribution } from '../schemas';
import { LeagueAvatar } from './LeagueAvatar';
import { durationHours, roundRange } from './LeagueScoreHistory';
import { LeagueCard, leagueStyles } from './LeagueUI';

function compactDecimal(value: string) {
  const decimalPoint = value.indexOf('.');
  if (decimalPoint < 0) return value;
  let end = value.length;
  while (end > decimalPoint + 1 && value[end - 1] === '0') end--;
  return value.slice(0, end === decimalPoint + 1 ? decimalPoint : end);
}

export function LeagueContributionRow({
  item,
  accountId,
  timezone,
}: Readonly<{
  item: LeagueContribution;
  accountId: number;
  timezone: string;
}>) {
  const p = usePalette();
  const own = item.user_id === accountId;
  const name = item.display_name ?? 'Member';
  const calculation = own ? item.calculation : undefined;
  return (
    <LeagueCard>
      <View style={leagueStyles.row}>
        <LeagueAvatar accountId={accountId} name={name} path={item.picture_url} member size={36} />
        <View style={{ flex: 1, minWidth: 0, gap: spacing['space-1'] }}>
          <Text style={[textStyles.label, { color: p.ink }]}>
            {name}
            {own ? ' (you)' : ''}
          </Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            {roundRange(item.start_at, item.end_at, timezone)}
          </Text>
        </View>
        <Text
          style={[
            textStyles.label,
            {
              color: p['brand-ink'],
              fontVariant: ['tabular-nums'],
              textAlign: 'right',
              maxWidth: '45%',
            },
          ]}
        >
          {item.score} points
        </Text>
      </View>
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        Workout #{item.session_id} · {item.local_day}
      </Text>
      {calculation ? (
        <Text style={[textStyles['body-sm'], { color: p.ink }]}>
          Volume {compactDecimal(calculation.volume_kg_reps)} kg reps · Duration{' '}
          {compactDecimal(durationHours(calculation.duration_us))} h · Body weight{' '}
          {compactDecimal(calculation.body_weight_kg)} kg
        </Text>
      ) : null}
    </LeagueCard>
  );
}
