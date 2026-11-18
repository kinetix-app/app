import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, textStyles, usePalette } from '@/theme/tokens';
import type { Food } from '../schemas';

export type NutritionValues = Pick<Food, 'calories' | 'carbohydrates' | 'protein' | 'fats'>;

const macros = [
  ['C', 'carbohydrates', 'Carbs'],
  ['P', 'protein', 'Protein'],
  ['F', 'fats', 'Fat'],
] as const;

export function NutritionSummary({
  values,
  factor = 1,
  precision = 0,
  perServing = false,
  compact = false,
}: Readonly<{
  values: NutritionValues;
  factor?: number;
  precision?: number;
  perServing?: boolean;
  compact?: boolean;
}>) {
  const p = usePalette();
  const typography = compact ? textStyles.caption : textStyles.overline;
  const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: precision });
  const format = (value: number) => formatter.format(value * factor);
  return (
    <View style={[styles.summary, compact && styles.compact]}>
      {perServing ? <Text style={[typography, { color: p['ink-muted'] }]}>Per serving</Text> : null}
      <Text style={[typography, styles.tabular, { color: p['ink-muted'] }]}>
        {format(values.calories)} KCAL
      </Text>
      {macros.map(([label, field, name]) => (
        <View key={field} style={styles.macro}>
          <Text accessibilityLabel={name} style={[typography, { color: p.ink }]}>
            {label}
          </Text>
          <Text style={[typography, styles.tabular, { color: p['ink-muted'] }]}>
            {format(values[field])}g
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing['space-2'],
  },
  compact: { columnGap: spacing['space-2'], rowGap: spacing['space-1'] },
  macro: { flexDirection: 'row', alignItems: 'baseline', gap: spacing['space-1'] },
  tabular: { fontVariant: ['tabular-nums'] },
});
