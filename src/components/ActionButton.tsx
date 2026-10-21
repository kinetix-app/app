import Ionicons from '@expo/vector-icons/Ionicons';
import React, { type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';

type ActionButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
  icon?: ComponentProps<typeof Ionicons>['name'];
  iconPosition?: 'start' | 'end';
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function ActionButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  iconPosition = 'end',
  disabled = false,
  accessibilityLabel,
  style,
}: ActionButtonProps) {
  const primary = variant === 'primary';
  const iconElement = icon ? (
    <Ionicons name={icon} size={19} color={primary ? colors.onAccent : colors.textPrimary} />
  ) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.outline,
        (pressed || disabled) && styles.dimmed,
        style,
      ]}
    >
      {iconPosition === 'start' ? iconElement : null}
      <Text style={primary ? styles.primaryText : styles.outlineText}>{title}</Text>
      {iconPosition === 'end' ? iconElement : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  primary: { minHeight: 54, borderRadius: 14, backgroundColor: colors.accent },
  outline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  dimmed: { opacity: 0.7 },
  primaryText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  outlineText: { color: colors.textLabel, fontSize: 13, fontWeight: '600' },
});
