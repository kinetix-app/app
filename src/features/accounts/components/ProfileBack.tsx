import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable } from 'react-native';
import { sizes, usePalette } from '@/theme/tokens';

export function ProfileBack({
  onPress,
  label = 'Back to profile',
  disabled = false,
}: Readonly<{ onPress: () => void; label?: string; disabled?: boolean }>) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minWidth: sizes['tap-min'],
        minHeight: sizes['tap-min'],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather name="arrow-left" size={24} color={p.ink} />
    </Pressable>
  );
}
