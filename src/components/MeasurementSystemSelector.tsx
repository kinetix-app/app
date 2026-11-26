import { getTranslation } from '@/i18n/catalog';
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLanguage } from '@/i18n/Language';
import type { MeasurementSystem } from '@/features/accounts/profileForm';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

const systems = [
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
] as const;

export function MeasurementSystemSelector({
  value,
  onChange,
  label,
  disabled = false,
}: Readonly<{
  value: MeasurementSystem | null;
  onChange: (system: MeasurementSystem) => void;
  label?: string;
  disabled?: boolean;
}>) {
  const p = usePalette();
  const language = useLanguage();
  const es = language === 'es';

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label ?? getTranslation(language)('accountsUi.measurement_system')}
      style={styles.group}
    >
      {systems.map((system) => {
        const selected = value === system.value;
        return (
          <Pressable
            key={system.value}
            accessibilityRole="radio"
            accessibilityLabel={es && system.value === 'metric' ? 'Métrico' : system.label}
            accessibilityState={{ checked: selected, selected, disabled }}
            aria-checked={selected}
            disabled={disabled}
            onPress={() => onChange(system.value)}
            style={({ pressed }) => [
              styles.option,
              {
                borderColor: selected ? p.brand : p['line-strong'],
                backgroundColor: selected ? p['brand-soft'] : p['surface-300'],
                opacity: disabled || pressed ? 0.65 : 1,
              },
            ]}
          >
            <Text style={[styles.label, { color: selected ? p['brand-ink'] : p.ink }]}>
              {es && system.value === 'metric' ? 'Métrico' : system.label}
            </Text>
            <View style={styles.indicator} aria-hidden>
              {selected ? <Feather name="check" size={16} color={p['brand-ink']} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', gap: spacing['space-2'] },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['space-1'],
    minHeight: sizes['control-height'],
    paddingHorizontal: spacing['space-2'],
    paddingVertical: spacing['space-2'],
    borderRadius: radii['radius-md'],
    borderWidth: 1,
  },
  label: { ...textStyles.label, flexShrink: 1, includeFontPadding: false },
  indicator: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
});
