import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Controller, useForm, type UseFormReturn } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader, screenContentStyle } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { getObjective } from '@/features/accounts/api';
import type { Objective } from '@/features/accounts/schemas';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

import { nutritionApi } from '../api';
import { nutritionGoalInputSchema, type NutritionGoal, type NutritionGoalInput } from '../schemas';

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

type NutritionGoalEditorProps = Readonly<{ accountId: number; onClose: () => void }>;
type NutritionGoalEditorViewProps = Readonly<{
  form: UseFormReturn<Values>;
  loading: boolean;
  failed: boolean;
  currentObjective: Objective | null;
  savedGoal: NutritionGoal | null | undefined;
  saving: boolean;
  mutationFailed: boolean;
  validationError: string;
  onClose: () => void;
  onRetry: () => void;
  onSave: () => void;
}>;

function parseGoalValues(values: Values): NutritionGoalInput | undefined {
  const amounts = Object.fromEntries(fields.map(([field]) => [field, Number(values[field])]));
  const parsed = nutritionGoalInputSchema.safeParse(amounts);
  const validText = fields.every(([field]) => /^\d+(?:\.\d{1,2})?$/.test(values[field]));
  return validText && parsed.success ? parsed.data : undefined;
}

function savedGoalNote(savedGoal: NutritionGoal | null | undefined, current: Objective | null) {
  if (!savedGoal || savedGoal.objective === current) return undefined;
  if (savedGoal.objective)
    return `These saved amounts belong to ${objectives[savedGoal.objective]}.`;
  return 'These saved amounts have no recorded objective.';
}

type NutritionGoalFormProps = Readonly<{
  form: UseFormReturn<Values>;
  currentObjective: Objective | null;
  note?: string;
  errorMessage: string;
  saving: boolean;
  onSave: () => void;
}>;

function NutritionGoalForm({
  form,
  currentObjective,
  note,
  errorMessage,
  saving,
  onSave,
}: NutritionGoalFormProps) {
  const p = usePalette();
  return (
    <>
      <Text style={[textStyles['title-md'], { color: p.ink }]}>
        {currentObjective
          ? `Your objective: ${objectives[currentObjective]}`
          : 'Choose an objective first'}
      </Text>
      <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
        Choose your own daily targets for this objective. These are your chosen amounts. You can
        change them later and record food without a target.
      </Text>
      {note ? (
        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
          {note} Review them before saving for your current objective.
        </Text>
      ) : null}
      {fields.map(([field, label, unit]) => (
        <View key={field} style={[styles.card, { backgroundColor: p['surface-200'] }]}>
          <Text style={[textStyles.label, { color: p.ink }]}>{label}</Text>
          <Controller
            control={form.control}
            name={field}
            render={({ field: input }) => (
              <TextField
                accessibilityLabel={label}
                keyboardType="decimal-pad"
                value={input.value}
                editable={!saving}
                onChangeText={input.onChange}
                onBlur={input.onBlur}
                inputStyle={textStyles['title-md']}
              />
            )}
          />
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{unit}</Text>
        </View>
      ))}
      {errorMessage ? (
        <Text accessibilityRole="alert" style={[textStyles.body, { color: p.danger }]}>
          {errorMessage}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !currentObjective || saving }}
        disabled={!currentObjective || saving}
        onPress={onSave}
        style={[
          styles.action,
          {
            backgroundColor: p.brand,
            borderRadius: radii['radius-pill'],
            opacity: !currentObjective || saving ? 0.55 : 1,
          },
        ]}
      >
        <Text style={[textStyles.label, { color: p['on-brand'] }]}>
          {saving ? 'Saving…' : 'Save goal'}
        </Text>
      </Pressable>
    </>
  );
}

function NutritionGoalEditorView({
  form,
  loading,
  failed,
  currentObjective,
  savedGoal,
  saving,
  mutationFailed,
  validationError,
  onClose,
  onRetry,
  onSave,
}: NutritionGoalEditorViewProps) {
  const p = usePalette();
  const note = savedGoalNote(savedGoal, currentObjective);
  let errorMessage = validationError;
  if (!errorMessage && mutationFailed) errorMessage = 'Could not save your goal. Try again.';
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
              {savedGoal ? 'Back' : 'Set up later'}
            </Text>
          </Pressable>
          {loading ? <Text style={[textStyles.body, { color: p.ink }]}>Loading goal…</Text> : null}
          {failed ? (
            <View style={styles.card}>
              <Text accessibilityRole="alert" style={[textStyles.body, { color: p.danger }]}>
                Could not load your nutrition goal.
              </Text>
              <Pressable accessibilityRole="button" onPress={onRetry} style={styles.action}>
                <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
                  Retry loading goal
                </Text>
              </Pressable>
            </View>
          ) : null}
          {!loading && !failed ? (
            <NutritionGoalForm
              form={form}
              currentObjective={currentObjective}
              note={note}
              errorMessage={errorMessage}
              saving={saving}
              onSave={onSave}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function NutritionGoalEditor({ accountId, onClose }: NutritionGoalEditorProps) {
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
    const input = parseGoalValues(values);
    if (!input) {
      setValidationError(
        'Enter calories above zero and nonnegative grams, with up to two decimals.',
      );
      return;
    }
    setValidationError('');
    busy.current = true;
    mutation.mutate(input, {
      onSettled: () => {
        busy.current = false;
      },
    });
  }
  return (
    <NutritionGoalEditorView
      form={form}
      loading={query.isPending || objective.isPending}
      failed={query.isError || objective.isError}
      currentObjective={current ?? null}
      savedGoal={query.data}
      saving={mutation.isPending}
      mutationFailed={mutation.isError}
      validationError={validationError}
      onClose={onClose}
      onRetry={() => {
        void query.refetch();
        void objective.refetch();
      }}
      onSave={() => {
        void form.handleSubmit(save)();
      }}
    />
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: spacing['space-5'], paddingBottom: spacing['space-10'] },
  card: { borderRadius: radii['radius-lg'], padding: spacing['space-4'], gap: spacing['space-3'] },
  action: { minHeight: sizes['control-height'], alignItems: 'center', justifyContent: 'center' },
});
