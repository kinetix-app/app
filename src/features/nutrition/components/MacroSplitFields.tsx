import React from 'react';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TextField } from '@/components/TextField';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import {
  hundredths,
  macroFields,
  convertMacroDraft,
  rebalanceGrams,
  rebalancePercentages,
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
  const equivalents = convertMacroDraft(values, mode);
  const energy = hundredths(calories);
  const updateMacro = (macro: (typeof macroFields)[number][0], value: string) => {
    if (mode === 'grams') {
      const balanced = rebalanceGrams(values, macro, value);
      if (!balanced) {
        form.setValue(macro, value, { shouldDirty: true });
        return;
      }
      const percentages = convertMacroDraft({ ...values, ...balanced }, 'grams');
      const normalizedGrams = convertMacroDraft(percentages, 'percentages');
      macroFields.forEach(([field]) =>
        form.setValue(field, normalizedGrams[field], { shouldDirty: true }),
      );
      return;
    }
    const balanced = rebalancePercentages(values, macro, value);
    if (!balanced) {
      form.setValue(macro, value, { shouldDirty: true });
      return;
    }
    macroFields.forEach(([field]) => form.setValue(field, balanced[field], { shouldDirty: true }));
  };
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
                      onChangeText={(value) =>
                        mode === 'grams' ? input.onChange(value) : updateMacro(macro, value)
                      }
                      onBlur={() => {
                        if (mode === 'grams' && input.value !== '') updateMacro(macro, input.value);
                        input.onBlur();
                      }}
                      selectTextOnFocus
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
                        onChange={(value) => updateMacro(macro, value.toFixed(2))}
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
      {invalidAmounts ? (
        <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
          Use nonnegative numbers with up to two decimals.
        </Text>
      ) : null}
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
});
