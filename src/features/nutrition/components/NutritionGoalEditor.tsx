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
  nutritionDraftGoal,
  macroBudget,
  percentageTotal,
  convertMacroDraft,
  type MacroMode,
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
  mode: MacroMode;
  onModeChange: (mode: MacroMode) => void;
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
  mode: MacroMode;
  onModeChange: (mode: MacroMode) => void;
  currentObjective: Objective | null;
  note?: string;
  errorMessage: string;
  saving: boolean;
  onSave: () => void;
}>;

function NutritionGoalForm({
  form,
  mode,
  onModeChange,
  currentObjective,
  note,
  errorMessage,
  saving,
  onSave,
}: NutritionGoalFormProps) {
  const p = usePalette();
  const calories = useWatch({ control: form.control, name: 'calories' });
  const percentages = useWatch({ control: form.control });
  const values: Values = {
    calories,
    carbohydrates: percentages.carbohydrates ?? '',
    protein: percentages.protein ?? '',
    fats: percentages.fats ?? '',
  };
  const budget = macroBudget(values, mode);
  const validSplit = nutritionDraftGoal(values, mode);
  const disabled =
    !currentObjective ||
    saving ||
    !validSplit ||
    budget?.overBudget ||
    (mode === 'percentages' && percentageTotal(values) !== 100);
  const energy = hundredths(calories);
  const invalidCalories = calories !== '' && (!energy || energy > 99999999);
  return (
    <>
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        {currentObjective ? objectives[currentObjective] : 'Choose an objective first'}
      </Text>
      {note ? (
        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
          {note} Review before saving.
        </Text>
      ) : null}
      <View style={[styles.calories, { backgroundColor: p['surface-200'] }]}>
        <View style={styles.calorieCopy}>
          <Text style={[textStyles.label, { color: p.ink }]}>Daily calories</Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>kcal / day</Text>
        </View>
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
              containerStyle={styles.calorieInput}
              inputStyle={styles.compactInput}
            />
          )}
        />
      </View>
      {invalidCalories ? (
        <Text style={[textStyles['body-sm'], { color: p.danger }]}>
          Enter daily calories from 0.01 to 999999.99, with up to two decimals.
        </Text>
      ) : null}
      <MacroSplitFields
        form={form}
        calories={calories}
        mode={mode}
        onModeChange={onModeChange}
        saving={saving}
      />
      {mode === 'percentages' && budget && !budget.overBudget && percentageTotal(values) !== 100 ? (
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          Percentages must total 100% to save.
        </Text>
      ) : null}
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
  mode,
  onModeChange,
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
          <ScreenHeader title="Nutrition goal">
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.action}>
              <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
                {savedGoal ? 'Back' : 'Set up later'}
              </Text>
            </Pressable>
          </ScreenHeader>
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
              mode={mode}
              onModeChange={onModeChange}
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
  const [mode, setMode] = React.useState<MacroMode>('percentages');
  const drafts = React.useRef<Partial<Record<MacroMode, Values>>>({});
  const dirty = form.formState.isDirty;
  const hydrated = React.useRef(false);
  React.useEffect(() => {
    if (query.data && !hydrated.current) {
      const percentages = {
        calories: String(query.data.calories),
        ...percentagesFromGoal(query.data),
      };
      drafts.current = {
        percentages,
        grams: {
          calories: String(query.data.calories),
          carbohydrates: String(query.data.carbohydrates),
          protein: String(query.data.protein),
          fats: String(query.data.fats),
        },
      };
      form.reset(percentages);
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
    const input = nutritionDraftGoal(values, mode);
    const budget = macroBudget(values, mode);
    if (
      !input ||
      budget?.overBudget ||
      (mode === 'percentages' && percentageTotal(values) !== 100)
    ) {
      setValidationError('Enter valid amounts within your calorie budget.');
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
      mode={mode}
      onModeChange={(next) => {
        if (next === mode || busy.current) return;
        const values = form.getValues();
        const previous = drafts.current[next];
        drafts.current[mode] = { ...values };
        const converted =
          !dirty && previous
            ? { ...previous, calories: values.calories }
            : convertMacroDraft(values, mode);
        form.reset(converted);
        setValidationError('');
        setMode(next);
      }}
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
  content: {
    gap: spacing['space-2'],
    paddingTop: spacing['space-4'],
    paddingBottom: spacing['space-4'],
  },
  card: { borderRadius: radii['radius-lg'], padding: spacing['space-4'], gap: spacing['space-3'] },
  calories: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing['space-3'],
    borderRadius: radii['radius-md'],
    gap: spacing['space-3'],
  },
  calorieCopy: { gap: spacing['space-1'], flexShrink: 1 },
  calorieInput: { width: 144, minHeight: sizes['tap-min'] },
  compactInput: {
    minHeight: sizes['tap-min'] - 2,
    paddingVertical: spacing['space-1'],
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  action: {
    minHeight: sizes['tap-min'],
    paddingHorizontal: spacing['space-2'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
