import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

export function ProfileGroup({ title, children }: React.PropsWithChildren<{ title: string }>) {
  const p = usePalette();
  return (
    <View style={{ gap: spacing['space-2'] }}>
      <Text accessibilityRole="header" style={[textStyles.label, { color: p['ink-muted'] }]}>
        {title}
      </Text>
      <View
        style={{
          backgroundColor: p['surface-200'],
          borderRadius: radii['radius-md'],
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

export function ProfileRow({
  title,
  detail,
  icon,
  onPress,
  disabled = false,
  danger = false,
}: Readonly<{
  title: string;
  detail?: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}>) {
  const p = usePalette();
  const ink = danger ? p.danger : p.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? p['surface-300'] : undefined, opacity: disabled ? 0.55 : 1 },
      ]}
    >
      <Feather name={icon} size={20} color={danger ? p.danger : p['ink-muted']} />
      <View style={{ flex: 1, gap: spacing['space-1'] }}>
        <Text style={[textStyles.body, { color: ink }]}>{title}</Text>
        {detail ? (
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{detail}</Text>
        ) : null}
      </View>
      {!danger ? <Feather name="chevron-right" size={18} color={p['ink-muted']} /> : null}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-3'],
    minHeight: sizes['control-height'],
    paddingHorizontal: spacing['space-4'],
    paddingVertical: spacing['space-2'],
  },
});
