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
  const t = (en: string, es: string) => (language === 'es' ? es : en);
  const p = usePalette();
  const own = member.user_id === accountId;
  const name = member.display_name ?? t('Member', 'Miembro');
  const calculation = own ? item.calculation : undefined;
  let memberName = name;
  if (own) memberName = language === 'es' ? `${name} (tú)` : `${name} (you)`;
  const title = showMember ? memberName : `${t('Workout', 'Entrenamiento')} #${item.session_id}`;
  const completionDate = new Date(item.ended_at).toLocaleString(
    language === 'es' ? 'es' : undefined,
    { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone },
  );
  const detail = showMember
    ? `${t('Workout', 'Entrenamiento')} #${item.session_id} · ${item.local_day}`
    : `${t('Completed', 'Completado')} ${completionDate}`;
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
        <Text style={[textStyles.caption, { color: p['ink-muted'] }]}>{t('points', 'puntos')}</Text>
      </View>
    </>
  );
  return (
    <LeagueCard>
      {onOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            language === 'es'
              ? `Ver historial de puntos de ${name}`
              : `View score history for ${name}`
          }
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
          {t('Volume', 'Volumen')} {formatScoreMeasurement(calculation.volume_kg_reps)} kg{' '}
          {t('reps', 'reps')} · {t('Duration', 'Duración')} {durationHours(calculation.duration_us)}{' '}
          h · {t('Body weight', 'Peso corporal')}{' '}
          {formatScoreMeasurement(calculation.body_weight_kg)} kg
        </Text>
      ) : null}
      {own && onOpenWorkout ? (
        <Button
          title={t('View workout', 'Ver entrenamiento')}
          secondary
          accessibilityLabel={`${t('View workout', 'Ver entrenamiento')} ${item.session_id}`}
          onPress={onOpenWorkout}
        />
      ) : null}
    </LeagueCard>
  );
}
