import { getTranslation } from '@/i18n/catalog';
import { useLanguage } from '@/i18n/Language';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import type { ScoreHistoryItem, ScoreHistoryMember } from '../schemas';
import { durationHours, formatScoreMeasurement, roundRange } from '../scoreDisplay';
import { LeagueAvatar } from './LeagueAvatar';
import { Button } from '@/components/Button';
import { LeagueCard, leagueStyles } from './LeagueUI';

export function LeagueContributionRow({
  item,
  member,
  accountId,
  timezone,
  showMember = true,
  onOpen,
  onOpenWorkout,
}: Readonly<{
  item: ScoreHistoryItem;
  member: ScoreHistoryMember;
  accountId: number;
  timezone: string;
  showMember?: boolean;
  onOpen?: () => void;
  onOpenWorkout?: () => void;
}>) {
  const language = useLanguage();

  const p = usePalette();
  const own = member.user_id === accountId;
  const name = member.display_name ?? getTranslation(language)('socialAdditional.member_10100e');
  const calculation = own ? item.calculation : undefined;
  let memberName = name;
  if (own) memberName = getTranslation(language)('leagues.you', { name });
  const title = showMember
    ? memberName
    : `${getTranslation(language)('socialAdditional.workout_c81493')} #${item.session_id}`;
  const completionDate = new Date(item.ended_at).toLocaleString(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  });
  const detail = showMember
    ? `${getTranslation(language)('socialAdditional.workout_c81493')} #${item.session_id} · ${item.local_day}`
    : `${getTranslation(language)('socialAdditional.completed_185818')} ${completionDate}`;
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
        <Text style={[textStyles.label, { color: p.ink }]}>{title}</Text>
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {roundRange(item.start_at, item.end_at, timezone, language)}
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
        <Text style={[textStyles.caption, { color: p['ink-muted'] }]}>
          {getTranslation(language)('socialAdditional.points_9e8145')}
        </Text>
      </View>
    </>
  );
  return (
    <LeagueCard>
      {onOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={getTranslation(language)('leagues.viewScoreHistoryFor', { name })}
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
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{detail}</Text>
      {calculation ? (
        <Text style={[textStyles['body-sm'], { color: p.ink }]}>
          {getTranslation(language)('socialAdditional.volume_bbc801')}{' '}
          {formatScoreMeasurement(calculation.volume_kg_reps)} kg{' '}
          {getTranslation(language)('socialAdditional.reps_488acf')} ·{' '}
          {getTranslation(language)('socialAdditional.duration_c00c5f')}{' '}
          {durationHours(calculation.duration_us)} h ·{' '}
          {getTranslation(language)('socialAdditional.bodyWeight_dc5637')}{' '}
          {formatScoreMeasurement(calculation.body_weight_kg)} kg
        </Text>
      ) : null}
      {own && onOpenWorkout ? (
        <Button
          title={getTranslation(language)('socialAdditional.viewWorkout_79f257')}
          secondary
          accessibilityLabel={`${getTranslation(language)('socialAdditional.viewWorkout_79f257')} ${item.session_id}`}
          onPress={onOpenWorkout}
        />
      ) : null}
    </LeagueCard>
  );
}
