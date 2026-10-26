import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

type SetupButtonProps = Readonly<{
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}>;

export function SetupButton({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: SetupButtonProps) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: sizes['control-height'],
        padding: spacing['space-4'],
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: radii['radius-pill'],
        backgroundColor: secondary ? p['surface-300'] : p.brand,
        opacity: disabled || pressed ? 0.55 : 1,
      })}
    >
      <Text style={[textStyles.label, { color: secondary ? p.ink : p['on-brand'] }]}>{title}</Text>
    </Pressable>
  );
}
export const setupStyles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: spacing['space-4'],
    paddingTop: spacing['space-8'],
    paddingBottom: spacing['space-8'],
    gap: spacing['space-5'],
  },
  card: { borderRadius: radii['radius-lg'], padding: spacing['space-4'], gap: spacing['space-3'] },
  field: {
    minHeight: sizes['control-height'],
    borderWidth: 1,
    borderRadius: radii['radius-md'],
    padding: spacing['space-3'],
  },
});
