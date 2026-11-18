import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text } from 'react-native';

import { radii, sizes, spacing, usePalette } from '@/theme/tokens';

export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
  accessibilityLabel,
  tone,
  icon,
}: Readonly<{
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  accessibilityLabel?: string;
  tone?: 'positive' | 'danger';
  icon?: React.ComponentProps<typeof Feather>['name'];
}>) {
  const p = usePalette();
  const background = buttonBackground(tone, secondary, p);
  const foreground = buttonForeground(tone, secondary, p);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: spacing['space-2'],
        minHeight: sizes['control-height'],
        paddingHorizontal: spacing['space-5'],
        paddingVertical: spacing['space-3'],
        borderRadius: radii['radius-pill'],
        backgroundColor: background,
        borderWidth: tone === 'danger' ? 1 : 0,
        borderColor: tone === 'danger' ? p.danger : background,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled || pressed ? 0.55 : 1,
      })}
    >
      {icon ? <Feather name={icon} size={18} color={foreground} /> : null}
      <Text style={{ color: foreground, fontSize: 14, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}
function buttonBackground(
  tone: 'positive' | 'danger' | undefined,
  secondary: boolean | undefined,
  palette: ReturnType<typeof usePalette>,
) {
  if (tone === 'danger' || secondary) return palette['surface-300'];
  if (tone === 'positive') return palette['brand-soft'];
  return palette.brand;
}

function buttonForeground(
  tone: 'positive' | 'danger' | undefined,
  secondary: boolean | undefined,
  palette: ReturnType<typeof usePalette>,
) {
  if (tone === 'danger') return palette.danger;
  if (tone === 'positive') return palette['brand-ink'];
  return secondary ? palette.ink : palette['on-brand'];
}
