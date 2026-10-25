import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader, screenContentStyle } from '@/components/ScreenHeader';
import { getObjective } from '@/features/accounts/api';
import type { Objective } from '@/features/accounts/schemas';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

import { nutritionApi } from '../api';
import { nutritionGoalInputSchema, type NutritionGoalInput } from '../schemas';

const objectives: Record<Objective, string> = {
  build_muscle: 'Build muscle',
  lose_fat: 'Lose fat',
  gain_weight: 'Gain weight',
  maintain_weight: 'Maintain weight',
};
const fields = [
  ['calories', 'Daily calorie goal', 'kcal per day'],
  ['protein', 'Daily protein goal', 'g per day'],
  ['carbohydrates', 'Daily carbohydrate goal', 'g per day'],
  ['fats', 'Daily fat goal', 'g per day'],
] as const;
type Values = Record<(typeof fields)[number][0], string>;
const empty: Values = { calories: '', protein: '', carbohydrates: '', fats: '' };

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
  const objective = useQuery({
    queryKey: ['accounts', accountId, 'objective'],
    queryFn: ({ signal }) => getObjective(signal),
    retry: false,
  });
  const form = useForm<Values>({ defaultValues: empty });
  const hydrated = React.useRef(false);
  React.useEffect(() => {
    if (query.data && !hydrated.current) {
      form.reset({
        calories: String(query.data.calories),
        protein: String(query.data.protein),
        carbohydrates: String(query.data.carbohydrates),
        fats: String(query.data.fats),
      });
      hydrated.current = true;
    }
  }, [query.data, form]);
  const mutation = useMutation({
    mutationFn: (input: NutritionGoalInput) =>
      query.data ? nutritionApi.updateGoal(input) : nutritionApi.createGoal(input),
    onSuccess: (goal) => {
      cache.setQueryData(['nutrition', accountId, 'goal'], goal);
      onClose();
    },
  });
  const busy = React.useRef(false);
  const [validationError, setValidationError] = React.useState('');
  const current = objective.data?.objective;
  function save(values: Values) {
    if (busy.current || mutation.isPending || !current) return;
    const amounts = Object.fromEntries(fields.map(([field]) => [field, Number(values[field])]));
    const parsed = nutritionGoalInputSchema.safeParse(amounts);
    const validText = fields.every(([field]) => /^\d+(?:\.\d{1,2})?$/.test(values[field]));
    if (!validText || !parsed.success) {
      setValidationError(
        'Enter calories above zero and nonnegative grams, with up to two decimals.',
      );
      return;
    }
    setValidationError('');
    busy.current = true;
    mutation.mutate(parsed.data, {
      onSettled: () => {
        busy.current = false;
      },
    });
  }
  const loading = query.isPending || objective.isPending;
  const failed = query.isError || objective.isError;
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p['surface-100'] }]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[screenContentStyle, styles.content]}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader title="Nutrition goal" />
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.action}>
            <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
              {query.data ? 'Back' : 'Set up later'}
            </Text>
          </Pressable>
          {loading ? <Text style={[textStyles.body, { color: p.ink }]}>Loading goal…</Text> : null}
          {failed ? (
            <View style={styles.card}>
              <Text accessibilityRole="alert" style={[textStyles.body, { color: p.danger }]}>
                Could not load your nutrition goal.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void query.refetch();
                  void objective.refetch();
                }}
                style={styles.action}
              >
                <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
                  Retry loading goal
                </Text>
              </Pressable>
            </View>
          ) : null}
          {!loading && !failed ? (
            <>
              <Text style={[textStyles['title-md'], { color: p.ink }]}>
                {current ? `Your objective: ${objectives[current]}` : 'Choose an objective first'}
              </Text>
              <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
                Choose your own daily targets for this objective. These are your chosen amounts. You
                can change them later and record food without a target.
              </Text>
              {query.data && query.data.objective !== current ? (
                <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
                  {query.data.objective
                    ? `These saved amounts belong to ${objectives[query.data.objective]}.`
                    : 'These saved amounts have no recorded objective.'}{' '}
                  Review them before saving for your current objective.
                </Text>
              ) : null}
              {fields.map(([field, label, unit]) => (
                <View key={field} style={[styles.card, { backgroundColor: p['surface-200'] }]}>
                  <Text style={[textStyles.label, { color: p.ink }]}>{label}</Text>
                  <Controller
                    control={form.control}
                    name={field}
                    render={({ field: input }) => (
                      <TextInput
                        accessibilityLabel={label}
                        keyboardType="decimal-pad"
                        value={input.value}
                        editable={!mutation.isPending}
                        onChangeText={input.onChange}
                        onBlur={input.onBlur}
                        style={[
                          styles.input,
                          {
                            color: p.ink,
                            borderColor: p['line-strong'],
                            backgroundColor: p['surface-300'],
                          },
                        ]}
                      />
                    )}
                  />
                  <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{unit}</Text>
                </View>
              ))}
              {validationError || mutation.isError ? (
                <Text accessibilityRole="alert" style={[textStyles.body, { color: p.danger }]}>
                  {validationError || 'Could not save your goal. Try again.'}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !current || mutation.isPending }}
                disabled={!current || mutation.isPending}
                onPress={() => void form.handleSubmit(save)()}
                style={[
                  styles.action,
                  {
                    backgroundColor: p.brand,
                    borderRadius: radii['radius-pill'],
                    opacity: !current || mutation.isPending ? 0.55 : 1,
                  },
                ]}
              >
                <Text style={[textStyles.label, { color: p['on-brand'] }]}>
                  {mutation.isPending ? 'Saving…' : 'Save goal'}
                </Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
  action: { minHeight: sizes['control-height'], alignItems: 'center', justifyContent: 'center' },
});
