import { getTranslation } from '@/i18n/catalog';
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable } from 'react-native';
import { useLanguage } from '@/i18n/Language';
import { sizes, usePalette } from '@/theme/tokens';

export function ProfileBack({
  onPress,
  label,
  disabled = false,
}: Readonly<{ onPress: () => void; label?: string; disabled?: boolean }>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? getTranslation(es)('accountsUi.back_to_profile')}
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
