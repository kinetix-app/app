import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader, screenContentStyle } from '@/components/ScreenHeader';
import { ApiError } from '@/services/apiClient';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

import { nutritionApi } from '../api';
import type { NutritionGoalInput } from '../schemas';

type Macro = 'carbohydrates' | 'protein' | 'fats';
type Percentages = Record<Macro, number>;

const defaults: Percentages = { carbohydrates: 50, protein: 20, fats: 30 };
const labels: Record<Macro, string> = { carbohydrates: 'Carbs', protein: 'Protein', fats: 'Fat' };
const factors: Record<Macro, number> = { carbohydrates: 4, protein: 4, fats: 9 };

function distribute(changed: Macro, value: number, current: Percentages): Percentages {
  const next = { ...current, [changed]: Math.max(0, Math.min(100, Math.round(value))) };
  const others = (Object.keys(next) as Macro[]).filter((key) => key !== changed);
  const remaining = 100 - next[changed];
  const currentOtherTotal = others.reduce((sum, key) => sum + current[key], 0);
  if (currentOtherTotal === 0) {
    next[others[0]] = remaining;
    next[others[1]] = 0;
    return next;
  }
  next[others[0]] = Math.round((current[others[0]] / currentOtherTotal) * remaining);
  next[others[1]] = remaining - next[others[0]];
  return next;
}

function fromGoal(goal: {
  calories: number;
  protein: number;
  carbohydrates: number;
  fats: number;
}): Percentages {
  const raw: Percentages = {
    carbohydrates: (goal.carbohydrates * 4 * 100) / goal.calories,
    protein: (goal.protein * 4 * 100) / goal.calories,
    fats: (goal.fats * 9 * 100) / goal.calories,
  };
  const rounded = {
    carbohydrates: Math.round(raw.carbohydrates),
    protein: Math.round(raw.protein),
    fats: Math.round(raw.fats),
  };
  return distribute(
    'fats',
    rounded.fats + (100 - rounded.carbohydrates - rounded.protein - rounded.fats),
    rounded,
  );
}

export function NutritionGoalEditor({
  accountId,
  onClose,
}: {
  accountId: number;
  onClose: () => void;
}) {
  const p = usePalette();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ['nutrition', accountId, 'goal'],
    queryFn: ({ signal }) => nutritionApi.goal(signal),
    retry: false,
  });
  const existing = query.data;
  const [calories, setCalories] = React.useState('2100');
  const [percentages, setPercentages] = React.useState<Percentages>(defaults);
  const hydrated = React.useRef(false);
  React.useEffect(() => {
    if (existing && !hydrated.current) {
      setCalories(String(existing.calories));
      setPercentages(fromGoal(existing));
      hydrated.current = true;
    }
  }, [existing]);
  const mutation = useMutation({
    mutationFn: (input: NutritionGoalInput) =>
      existing ? nutritionApi.updateGoal(input) : nutritionApi.createGoal(input),
    onSuccess: (goal) => {
      cache.setQueryData(['nutrition', accountId, 'goal'], goal);
      onClose();
    },
  });
  const parsedCalories = Number(calories.replace(',', '..'));
  const valid =
    Number.isFinite(parsedCalories) &&
    parsedCalories > 0 &&
    Object.values(percentages).reduce((a, b) => a + b, 0) === 100;
  const grams = (macro: Macro) => (parsedCalories * percentages[macro]) / 100 / factors[macro];
  const roundToTwoDecimals = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  function save() {
    if (!valid) return;
    mutation.mutate({
      calories: roundToTwoDecimals(parsedCalories),
      carbohydrates: roundToTwoDecimals(grams('carbohydrates')),
      protein: roundToTwoDecimals(grams('protein')),
      fats: roundToTwoDecimals(grams('fats')),
    });
  }
  if (query.isPending)
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: p['surface-100'] }]}>
        <Text style={[textStyles.body, { color: p.ink }]}>Loading goal…</Text>
      </SafeAreaView>
    );
  if (query.isError && !(query.error instanceof ApiError && query.error.status === 404))
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: p['surface-100'] }]}>
        <Text accessibilityRole="alert" style={[textStyles.body, { color: p.danger }]}>
          Could not load your nutrition goal.
        </Text>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p['surface-100'] }]}>
      <ScrollView
        contentContainerStyle={[screenContentStyle, styles.content]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader title="Nutrition goal" />
        <View style={[styles.card, { backgroundColor: p['surface-200'] }]}>
          <Text style={[textStyles['title-md'], { color: p.ink }]}>Daily calories</Text>
          <TextInput
            accessibilityLabel="Daily calorie goal"
            keyboardType="decimal-pad"
            value={calories}
            onChangeText={setCalories}
            style={[
              styles.input,
              { color: p.ink, borderColor: p['line-strong'], backgroundColor: p['surface-300'] },
            ]}
          />
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>kcal per day</Text>
        </View>
        <View style={[styles.card, { backgroundColor: p['surface-200'] }]}>
          <Text style={[textStyles['title-md'], { color: p.ink }]}>Macro split</Text>
          {(Object.keys(percentages) as Macro[]).map((macro) => (
            <View key={macro} style={styles.macro}>
              <View style={styles.macroHeader}>
                <Text style={[textStyles.label, { color: p.ink }]}>{labels[macro]}</Text>
                <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
                  {percentages[macro]}% ·{' '}
                  {Number.isFinite(grams(macro)) ? grams(macro).toFixed(1) : '—'} g
                </Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease ${labels[macro]}`}
                  onPress={() =>
                    setPercentages((current) => distribute(macro, current[macro] - 1, current))
                  }
                  style={[styles.step, { backgroundColor: p['surface-300'] }]}
                >
                  <Feather name="minus" size={20} color={p.ink} />
                </Pressable>
                <Text style={[textStyles['metric-md'], { color: p.ink }]}>
                  {percentages[macro]}%
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Increase ${labels[macro]}`}
                  onPress={() =>
                    setPercentages((current) => distribute(macro, current[macro] + 1, current))
                  }
                  style={[styles.step, { backgroundColor: p['surface-300'] }]}
                >
                  <Feather name="plus" size={20} color={p.ink} />
                </Pressable>
              </View>
            </View>
          ))}
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            Total: {Object.values(percentages).reduce((a, b) => a + b, 0)}%
          </Text>
        </View>
        {mutation.isError ? (
          <Text accessibilityRole="alert" style={[textStyles.body, { color: p.danger }]}>
            Could not save your goal. Try again.
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !valid || mutation.isPending }}
          disabled={!valid || mutation.isPending}
          onPress={save}
          style={[
            styles.save,
            { backgroundColor: p.brand, opacity: !valid || mutation.isPending ? 0.55 : 1 },
          ]}
        >
          <Text style={[textStyles.label, { color: p['on-brand'] }]}>
            {mutation.isPending ? 'Saving…' : 'Save goal'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: spacing['space-5'], paddingBottom: spacing['space-10'] },
  card: { borderRadius: radii['radius-lg'], padding: spacing['space-4'], gap: spacing['space-3'] },
  input: {
    minHeight: sizes['control-height'],
    borderWidth: 1,
    borderRadius: radii['radius-md'],
    paddingHorizontal: spacing['space-3'],
    ...textStyles['title-md'],
  },
  macro: { gap: spacing['space-2'] },
  macroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  stepper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  step: {
    width: sizes['tap-min'],
    height: sizes['tap-min'],
    borderRadius: radii['radius-pill'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  save: {
    minHeight: sizes['control-height'],
    borderRadius: radii['radius-pill'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
