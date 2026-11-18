import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import type { ScoreHistoryItem, ScoreHistoryMember } from '../schemas';
import { durationHours, formatScoreMeasurement, roundRange } from '../scoreDisplay';
import { LeagueAvatar } from './LeagueAvatar';
import { LeagueCard, leagueStyles } from './LeagueUI';

export function LeagueContributionRow({
  item,
  member,
  accountId,
  timezone,
  showMember = true,
  onOpen,
}: Readonly<{
  item: ScoreHistoryItem;
  member: ScoreHistoryMember;
  accountId: number;
  timezone: string;
  showMember?: boolean;
  onOpen?: () => void;
}>) {
  const p = usePalette();
  const own = member.user_id === accountId;
  const name = member.display_name ?? 'Member';
  const calculation = own ? item.calculation : undefined;
  const heading = (
    <>
      {showMember ? (
        <LeagueAvatar
          accountId={accountId}
          name={name}
          path={member.picture_url}
          member
          size={36}
        />
      ) : (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radii['radius-md'],
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: p['surface-300'],
          }}
        >
          <Ionicons name="barbell-outline" size={20} color={p['ink-muted']} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: spacing['space-1'] }}>
        <Text style={[textStyles.label, { color: p.ink }]}>
          {showMember ? `${name}${own ? ' (you)' : ''}` : `Workout #${item.session_id}`}
        </Text>
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {roundRange(item.start_at, item.end_at, timezone)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', maxWidth: '45%' }}>
        <Text
          style={[
            textStyles.label,
            { color: p['brand-ink'], fontVariant: ['tabular-nums'], textAlign: 'right' },
          ]}
        >
          {item.score}
        </Text>
        <Text style={[textStyles.caption, { color: p['ink-muted'] }]}>points</Text>
      </View>
    </>
  );
  return (
    <LeagueCard>
      {onOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View score history for ${name}`}
          onPress={onOpen}
          style={({ pressed }) => [
            leagueStyles.row,
            { minHeight: sizes['tap-min'], opacity: pressed ? 0.65 : 1 },
          ]}
        >
          {heading}
          <Ionicons name="chevron-forward" size={16} color={p['ink-muted']} />
        </Pressable>
      ) : (
        <View style={leagueStyles.row}>{heading}</View>
      )}
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        {showMember
          ? `Workout #${item.session_id} · ${item.local_day}`
          : `Completed ${new Date(item.ended_at).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: timezone,
            })}`}
      </Text>
      {calculation ? (
        <Text style={[textStyles['body-sm'], { color: p.ink }]}>
          Volume {formatScoreMeasurement(calculation.volume_kg_reps)} kg reps · Duration{' '}
          {durationHours(calculation.duration_us)} h · Body weight{' '}
          {formatScoreMeasurement(calculation.body_weight_kg)} kg
        </Text>
      ) : null}
    </LeagueCard>
  );
}
