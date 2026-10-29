import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Controller, useForm, useWatch, type UseFormReturn } from 'react-hook-form';
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
import {
  emptyPercentages,
  hundredths,
  macroSplitGoal,
  percentagesFromGoal,
  type MacroGoalValues,
} from '../macroSplit';
import { MacroSplitFields } from './MacroSplitFields';
import { type NutritionGoal, type NutritionGoalInput } from '../schemas';

const objectives: Record<Objective, string> = {
  build_muscle: 'Build muscle',
  lose_fat: 'Lose fat',
  gain_weight: 'Gain weight',
  maintain_weight: 'Maintain weight',
};
type Values = MacroGoalValues;
const empty: Values = { calories: '', ...emptyPercentages };

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

function savedGoalNote(savedGoal: NutritionGoal | null | undefined, current: Objective | null) {
  if (!savedGoal || savedGoal.objective === current) return undefined;
  if (savedGoal.objective) return `Saved for ${objectives[savedGoal.objective]}.`;
  return 'Saved without an objective.';
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
  const calories = useWatch({ control: form.control, name: 'calories' });
  const percentages = useWatch({ control: form.control });
  const validSplit = macroSplitGoal(calories, {
    carbohydrates: percentages.carbohydrates ?? '',
    protein: percentages.protein ?? '',
    fats: percentages.fats ?? '',
  });
  const disabled = !currentObjective || saving || !validSplit;
  const energy = hundredths(calories);
  const invalidCalories = calories !== '' && (!energy || energy > 99999999);
  return (
    <>
      <Text style={[textStyles['title-md'], { color: p.ink }]}>
        {currentObjective
          ? `Your objective: ${objectives[currentObjective]}`
          : 'Choose an objective first'}
      </Text>
      <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
        Set your daily calories and macro split.
      </Text>
      {note ? (
        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
          {note} Review before saving.
        </Text>
      ) : null}
      <View style={[styles.card, { backgroundColor: p['surface-200'] }]}>
        <Text style={[textStyles.label, { color: p.ink }]}>Daily calorie goal</Text>
        <Controller
          control={form.control}
          name="calories"
          render={({ field: input }) => (
            <TextField
              accessibilityLabel="Daily calorie goal"
              keyboardType="decimal-pad"
              value={input.value}
              editable={!saving}
              onChangeText={input.onChange}
              onBlur={input.onBlur}
              invalid={Boolean(invalidCalories)}
            />
          )}
        />
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>kcal per day</Text>
        {invalidCalories ? (
          <Text style={[textStyles['body-sm'], { color: p.danger }]}>
            Enter daily calories from 0.01 to 999999.99, with up to two decimals.
          </Text>
        ) : null}
      </View>
      <MacroSplitFields form={form} calories={calories} saving={saving} />
      {errorMessage ? (
        <Text accessibilityRole="alert" style={[textStyles.body, { color: p.danger }]}>
          {errorMessage}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onSave}
        style={[
          styles.action,
          {
            backgroundColor: p.brand,
            borderRadius: radii['radius-pill'],
            opacity: disabled ? 0.55 : 1,
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

export function NutritionGoalEditor(props: NutritionGoalEditorProps) {
  return <AccountNutritionGoalEditor key={props.accountId} {...props} />;
}

function AccountNutritionGoalEditor({ accountId, onClose }: NutritionGoalEditorProps) {
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
        ...percentagesFromGoal(query.data),
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
    const input = macroSplitGoal(values.calories, values);
    if (!input) {
      setValidationError(
        'Enter calories above zero and percentages totaling 100%, with up to two decimals.',
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
