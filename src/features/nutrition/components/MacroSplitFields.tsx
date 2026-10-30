import React from 'react';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TextField } from '@/components/TextField';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import {
  hundredths,
  macroFields,
  convertMacroDraft,
  macroBudget,
  type MacroGoalValues,
  type MacroMode,
} from '../macroSplit';
import { MacroRange } from './MacroRange';
import { MacroEnergyInfo } from './MacroEnergyInfo';

type Props = Readonly<{
  form: UseFormReturn<MacroGoalValues>;
  calories: string;
  mode: MacroMode;
  onModeChange: (mode: MacroMode) => void;
  saving: boolean;
}>;

export function MacroSplitFields({ form, calories, mode, onModeChange, saving }: Props) {
  const p = usePalette();
  const watched = useWatch({ control: form.control });
  const values: MacroGoalValues = {
    calories,
    carbohydrates: watched.carbohydrates ?? '',
    protein: watched.protein ?? '',
    fats: watched.fats ?? '',
  };
  const invalidAmounts = macroFields.some(
    ([macro]) =>
      values[macro] !== '' &&
      (hundredths(values[macro]) === undefined || hundredths(values[macro])! > 99999999),
  );
  const budget = macroBudget(values, mode);
  const equivalents = convertMacroDraft(values, mode);
  const energy = hundredths(calories);
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={[textStyles['title-md'], { color: p.ink }]}>Daily macros</Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Macro entry mode"
          style={[styles.modes, { backgroundColor: p['surface-300'] }]}
        >
          {(['percentages', 'grams'] as const).map((entry) => (
            <Pressable
              key={entry}
              accessibilityRole="radio"
              accessibilityLabel={entry === 'grams' ? 'Grams' : 'Percentages'}
              accessibilityState={{ checked: mode === entry, disabled: saving }}
              disabled={saving}
              onPress={() => onModeChange(entry)}
              style={[styles.mode, mode === entry && { backgroundColor: p['brand-soft'] }]}
            >
              <Text
                style={[
                  textStyles.label,
                  { color: mode === entry ? p['brand-ink'] : p['ink-muted'] },
                ]}
              >
                {entry === 'grams' ? 'Grams' : '%'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={[styles.card, { backgroundColor: p['surface-200'] }]}>
        {macroFields.map(([macro, label, factor], index) => (
          <View
            key={macro}
            style={[styles.macro, index > 0 && { borderTopWidth: 1, borderTopColor: p.line }]}
          >
            <View style={styles.row}>
              <View style={styles.name}>
                <Text style={[textStyles.label, { color: p.ink }]}>{label}</Text>
                <MacroEnergyInfo label={label} factor={factor} />
              </View>
              <Controller
                control={form.control}
                name={macro}
                render={({ field: input }) => {
                  const amount = hundredths(input.value);
                  const invalid = input.value !== '' && (amount === undefined || amount > 99999999);
                  return (
                    <TextField
                      accessibilityLabel={`${label} ${mode === 'grams' ? 'grams' : 'percentage'}`}
                      keyboardType="decimal-pad"
                      value={input.value}
                      onChangeText={input.onChange}
                      onBlur={input.onBlur}
                      editable={!saving}
                      invalid={invalid}
                      containerStyle={styles.number}
                      inputStyle={styles.numberInput}
                      trailing={
                        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                          {mode === 'grams' ? 'g' : '%'}
                        </Text>
                      }
                    />
                  );
                }}
              />
            </View>
            <View style={styles.row}>
              <View style={styles.range}>
                <Controller
                  control={form.control}
                  name={macro}
                  render={({ field: input }) => {
                    const maximum =
                      mode === 'grams' && energy ? Math.max(0.01, energy / 100 / factor) : 100;
                    return (
                      <MacroRange
                        label={`${label} range`}
                        maximum={maximum}
                        value={Math.min(maximum, (hundredths(input.value) ?? 0) / 100)}
                        onChange={(value) => input.onChange(value.toFixed(2))}
                        onBlur={input.onBlur}
                        disabled={saving}
                      />
                    );
                  }}
                />
              </View>
              <Text style={[textStyles['body-sm'], styles.equivalent, { color: p['ink-muted'] }]}>
                {equivalents[macro] || '—'}
                {mode === 'percentages' ? ' g' : '%'}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <View
        accessibilityLiveRegion="polite"
        style={[
          styles.budget,
          {
            backgroundColor: budget?.overBudget ? p['surface-300'] : p['surface-200'],
            borderColor: budget?.overBudget ? p.warning : p.line,
          },
        ]}
      >
        <View style={styles.row}>
          <Text style={[textStyles.label, { color: p.ink }]}>Required calories</Text>
          <Text style={[textStyles.label, { color: p.ink }]}>
            {budget
              ? `${budget.requiredCalories.toFixed(2)} kcal · ${budget.percentage.toFixed(2)}%`
              : '—'}
          </Text>
        </View>
        <Text
          style={[
            textStyles['body-sm'],
            { color: invalidAmounts ? p.danger : budget?.overBudget ? p.warning : p['ink-muted'] },
          ]}
        >
          {budget?.overBudget
            ? `Out of budget · ${budget.difference.toFixed(2)} kcal over ${Number(calories.replace(',', '.')).toFixed(2)} kcal`
            : budget
              ? `${Math.max(0, -budget.difference).toFixed(2)} kcal remaining`
              : invalidAmounts
                ? 'Use nonnegative numbers with up to two decimals.'
                : 'Enter calories and all three macros.'}
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing['space-2'],
  },
  modes: { flexDirection: 'row', borderRadius: radii['radius-md'], padding: spacing['space-1'] },
  mode: {
    minHeight: sizes['tap-min'],
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii['radius-sm'],
    paddingHorizontal: spacing['space-2'],
  },
  card: { borderRadius: radii['radius-lg'], paddingHorizontal: spacing['space-3'] },
  macro: { paddingVertical: spacing['space-1'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing['space-2'],
  },
  name: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  number: { width: 112, minHeight: sizes['tap-min'], paddingHorizontal: spacing['space-2'] },
  numberInput: {
    minHeight: sizes['tap-min'] - 2,
    paddingVertical: spacing['space-1'],
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  range: { flex: 1 },
  equivalent: { minWidth: 80, textAlign: 'right', fontVariant: ['tabular-nums'] },
  budget: {
    padding: spacing['space-3'],
    gap: spacing['space-1'],
    borderWidth: 1,
    borderRadius: radii['radius-md'],
  },
});
