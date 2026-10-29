import React from 'react';
import { MacroRange } from './MacroRange';
import { MacroEnergyInfo } from './MacroEnergyInfo';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';

import { TextField } from '@/components/TextField';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';

import {
  hundredths,
  macroFields,
  macroGrams,
  percentageTotal,
  type MacroGoalValues,
} from '../macroSplit';

type Props = Readonly<{
  form: UseFormReturn<MacroGoalValues>;
  calories: string;
  saving: boolean;
}>;

export function MacroSplitFields({ form, calories, saving }: Props) {
  const p = usePalette();
  const percentages = useWatch({ control: form.control });
  const values = {
    carbohydrates: percentages.carbohydrates ?? '',
    protein: percentages.protein ?? '',
    fats: percentages.fats ?? '',
  };
  const total = percentageTotal(values);
  return (
    <>
      <Text style={[textStyles['title-md'], { color: p.ink }]}>Macro split</Text>
      <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
        Use sliders or enter percentages. Total must be 100%.
      </Text>
      {macroFields.map(([macro, label, factor]) => (
        <View key={macro} style={[styles.card, { backgroundColor: p['surface-200'] }]}>
          <View style={styles.header}>
            <Text style={[textStyles.label, { color: p.ink }]}>{label}</Text>
            <MacroEnergyInfo label={label} factor={factor} />
          </View>
          <Controller
            control={form.control}
            name={macro}
            render={({ field: input }) => {
              const amount = hundredths(input.value);
              const invalid = input.value !== '' && (amount === undefined || amount > 10000);
              return (
                <>
                  <MacroRange
                    label={`${label} range`}
                    value={Math.min(100, (amount ?? 0) / 100)}
                    onChange={(value) => input.onChange(value.toFixed(2))}
                    onBlur={input.onBlur}
                    disabled={saving}
                  />
                  <TextField
                    accessibilityLabel={`${label} percentage`}
                    keyboardType="decimal-pad"
                    value={input.value}
                    onChangeText={input.onChange}
                    onBlur={input.onBlur}
                    editable={!saving}
                    invalid={invalid}
                    trailing={<Text style={[textStyles.body, { color: p['ink-muted'] }]}>%</Text>}
                  />
                  {invalid ? (
                    <Text style={[textStyles['body-sm'], { color: p.danger }]}>
                      Enter 0–100%, with up to two decimals.
                    </Text>
                  ) : null}
                </>
              );
            }}
          />
          <Text style={[textStyles.body, { color: p.ink }]}>
            {label}: {macroGrams(calories, values[macro], factor)?.toFixed(2) ?? '—'} g per day
          </Text>
        </View>
      ))}
      <Text accessibilityLiveRegion="polite" style={[textStyles.label, { color: p.ink }]}>
        Total: {total === undefined ? '—' : total.toFixed(2)}%
      </Text>
      {total !== 100 ? (
        <Text style={[textStyles.body, { color: p.danger }]}>
          Percentages must total 100% to save.
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-1'] },
  card: { borderRadius: radii['radius-lg'], padding: spacing['space-4'], gap: spacing['space-3'] },
});
