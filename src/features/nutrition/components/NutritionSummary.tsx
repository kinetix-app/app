import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import type { Food } from '../schemas';

export type NutritionValues = Pick<Food, 'calories' | 'carbohydrates' | 'protein' | 'fats'>;

const macros = [
  ['C', 'carbohydrates', 'Carbs', 'macro-carbs'],
  ['P', 'protein', 'Protein', 'macro-protein'],
  ['F', 'fats', 'Fat', 'macro-fat'],
] as const;

export function NutritionSummary({
  values,
  factor = 1,
  precision = 0,
  compact = false,
}: Readonly<{
  values: NutritionValues;
  factor?: number;
  precision?: number;
  compact?: boolean;
}>) {
  const p = usePalette();
  const typography = compact ? [textStyles.caption, styles.compactTypography] : textStyles.overline;
  const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: precision });
  const format = (value: number) => formatter.format(value * factor);
  return (
    <View style={[styles.summary, compact && styles.compact]}>
      <Text style={[typography, styles.tabular, { color: p['ink-muted'] }]}>
        {format(values.calories)} {compact ? 'kcal' : 'KCAL'}
      </Text>
      {macros.map(([label, field, name]) => (
        <View key={field} style={[styles.macro, compact && styles.compactMacro]}>
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

export function PortionNutritionPreview({
  values,
  factor,
  portion,
  precision = 1,
  embedded = false,
}: Readonly<{
  values: NutritionValues;
  factor: number;
  portion: string;
  precision?: number;
  embedded?: boolean;
}>) {
  const p = usePalette();
  const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: precision });
  const format = (value: number) => formatter.format(value * factor);

  return (
    <View
      style={[
        styles.portionPreview,
        !embedded && [styles.portionCard, { backgroundColor: p['surface-200'] }],
      ]}
    >
      <View style={styles.portionHeader}>
        <Text style={[textStyles['metric-md'], styles.tabular, { color: p.ink }]}>
          {format(values.calories)} kcal
        </Text>
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{portion}</Text>
      </View>
      <View style={styles.portionMacros}>
        {macros.map(([, field, label, color]) => (
          <View key={field} style={styles.portionMacro}>
            <Text style={[textStyles['body-sm'], { color: p[color] }]}>{label}</Text>
            <Text style={[textStyles.label, styles.tabular, { color: p.ink }]}>
              {format(values[field])} g
            </Text>
          </View>
        ))}
      </View>
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
  compact: { gap: spacing['space-1'] },
  compactTypography: { letterSpacing: 0 },
  compactMacro: { gap: spacing['space-1'] / 2 },
  macro: { flexDirection: 'row', alignItems: 'baseline', gap: spacing['space-1'] },
  portionPreview: { gap: spacing['space-2'] },
  portionCard: {
    borderRadius: radii['radius-md'],
    padding: spacing['space-3'],
  },
  portionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: spacing['space-2'],
  },
  portionMacros: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-2'] },
  portionMacro: { flexGrow: 1, minWidth: 68 },
  tabular: { fontVariant: ['tabular-nums'] },
});
