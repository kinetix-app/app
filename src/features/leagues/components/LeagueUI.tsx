import { useLanguage } from '@/i18n/Language';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LeagueAvatar } from './LeagueAvatar';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

export function LeagueCard({ children }: Readonly<React.PropsWithChildren>) {
  const p = usePalette();
  return <View style={[leagueStyles.card, { backgroundColor: p['surface-200'] }]}>{children}</View>;
}

export function LeagueIconButton({
  label,
  icon,
  onPress,
  disabled = false,
}: Readonly<{
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  disabled?: boolean;
}>) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: sizes['tap-min'],
        height: sizes['tap-min'],
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii['radius-pill'],
        backgroundColor: p['surface-300'],
        opacity: pressed || disabled ? 0.55 : 1,
        flexShrink: 0,
      })}
    >
      <Ionicons name={icon} size={22} color={p.ink} />
    </Pressable>
  );
}

export function LeagueAction({
  label,
  onPress,
  disabled = false,
  variant = 'neutral',
  icon,
}: Readonly<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'positive' | 'neutral';
  icon?: ComponentProps<typeof Ionicons>['name'];
}>) {
  const p = usePalette();
  const colors = {
    primary: { color: p['on-brand'], backgroundColor: p.brand },
    positive: { color: p['brand-ink'], backgroundColor: p['brand-soft'] },
    neutral: { color: p.ink, backgroundColor: p['surface-300'] },
  };
  const { color, backgroundColor } = colors[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => {
        const pressedOpacity = pressed ? 0.75 : 1;
        return [
          leagueStyles.action,
          {
            backgroundColor,
            borderColor: variant === 'neutral' ? p['line-strong'] : 'transparent',
            opacity: disabled ? 0.5 : pressedOpacity,
          },
        ];
      }}
    >
      {icon ? <Ionicons name={icon} size={20} color={color} /> : null}
      <Text style={[textStyles.label, { color, flexShrink: 1, textAlign: 'center' }]}>{label}</Text>
    </Pressable>
  );
}

export function LeagueRankingRow({
  row,
  current = false,
  accountId,
  onPress,
}: Readonly<{
  row: {
    position: number;
    display_name: string | null;
    score: string;
    picture_url?: string | null;
  };
  accountId: number;
  current?: boolean;
  onPress?: () => void;
}>) {
  const language = useLanguage();
  const p = usePalette();
  const memberName = row.display_name ?? (language === 'es' ? 'Miembro' : 'Member');
  let accessibilityHint: string | undefined;
  if (onPress)
    accessibilityHint =
      language === 'es' ? 'Abre el historial de puntos del miembro' : 'Opens member score history';
  const selfLabel = rankingSelfLabel(current, language);
  const Row = onPress ? Pressable : View;
  return (
    <Row
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={accessibilityHint}
      accessible
      accessibilityLabel={`#${row.position} ${memberName}: ${row.score} ${language === 'es' ? 'puntos' : 'points'}${selfLabel}`}
      style={[
        leagueStyles.ranking,
        { backgroundColor: current ? p['brand-soft'] : p['surface-300'] },
      ]}
    >
      <Text
        style={[textStyles['title-md'], { color: p['brand-ink'], fontVariant: ['tabular-nums'] }]}
      >
        #{row.position}
      </Text>
      <LeagueAvatar
        accountId={accountId}
        path={row.picture_url}
        name={memberName}
        member
        size={36}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[textStyles.label, { color: p.ink }]}>{memberName}</Text>
        {current ? (
          <Text style={[textStyles['body-sm'], { color: p['brand-ink'] }]}>
            {language === 'es' ? 'Tú' : 'You'}
          </Text>
        ) : null}
      </View>
      <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>
        <Text
          style={[
            textStyles.label,
            { color: p.ink, fontVariant: ['tabular-nums'], textAlign: 'right' },
          ]}
        >
          {row.score}
        </Text>
        <Text style={[textStyles.caption, { color: p['ink-muted'] }]}>
          {language === 'es' ? 'puntos' : 'points'}
        </Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={p['ink-muted']} /> : null}
    </Row>
  );
}

function rankingSelfLabel(current: boolean, language: 'en' | 'es') {
  if (!current) return '';
  return language === 'es' ? ', tú' : ', you';
}

export const leagueStyles = StyleSheet.create({
  card: { padding: spacing['space-4'], borderRadius: radii['radius-lg'], gap: spacing['space-4'] },
  section: { gap: spacing['space-3'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-3'] },
  action: {
    minHeight: sizes['control-height'],
    borderRadius: radii['radius-pill'],
    borderWidth: 1,
    paddingHorizontal: spacing['space-4'],
    paddingVertical: spacing['space-3'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['space-2'],
  },
  ranking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-3'],
    padding: spacing['space-3'],
    borderRadius: radii['radius-md'],
  },
});

export function LeagueDropdownTrigger({
  label,
  value,
  detail,
  icon,
  expanded,
  disabled,
  onPress,
}: Readonly<{
  label: string;
  value: string;
  detail?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  expanded: boolean;
  disabled?: boolean;
  onPress: () => void;
}>) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        leagueStyles.row,
        {
          minHeight: sizes['control-height'],
          padding: spacing['space-3'],
          borderRadius: radii['radius-md'],
          backgroundColor: p['surface-300'],
          borderWidth: 1,
          borderColor: p['line-strong'],
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={20} color={p['brand-ink']} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[textStyles.label, { color: p.ink }]}>{value}</Text>
        {detail ? (
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{detail}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-down" size={18} color={p['ink-muted']} />
    </Pressable>
  );
}
