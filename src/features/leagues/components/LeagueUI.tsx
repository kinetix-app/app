import Ionicons from '@expo/vector-icons/Ionicons';
import React, { type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

export function LeagueCard({ children }: React.PropsWithChildren) {
  const p = usePalette();
  return <View style={[leagueStyles.card, { backgroundColor: p['surface-200'] }]}>{children}</View>;
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
  const color =
    variant === 'primary' ? p['on-brand'] : variant === 'positive' ? p['brand-ink'] : p.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        leagueStyles.action,
        {
          backgroundColor:
            variant === 'primary'
              ? p.brand
              : variant === 'positive'
                ? p['brand-soft']
                : p['surface-300'],
          borderColor: variant === 'neutral' ? p['line-strong'] : 'transparent',
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={20} color={color} /> : null}
      <Text style={[textStyles.label, { color, flexShrink: 1, textAlign: 'center' }]}>{label}</Text>
    </Pressable>
  );
}

export function LeagueRankingRow({
  row,
  current = false,
}: Readonly<{
  row: { position: number; display_name: string | null; score: string };
  current?: boolean;
}>) {
  const p = usePalette();
  return (
    <View
      accessible
      accessibilityLabel={`#${row.position} ${row.display_name ?? 'Member'}: ${row.score} points${current ? ', you' : ''}`}
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
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[textStyles.label, { color: p.ink }]}>{row.display_name ?? 'Member'}</Text>
        {current ? (
          <Text style={[textStyles['body-sm'], { color: p['brand-ink'] }]}>You</Text>
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
        <Text style={[textStyles.caption, { color: p['ink-muted'] }]}>points</Text>
      </View>
    </View>
  );
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
