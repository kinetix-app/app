import React, { useEffect, useRef, useState } from 'react';
import { useForm, Controller, useFieldArray, useWatch, type Control } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Keyboard,
  Text,
  View,
} from 'react-native';
import DraggableFlatList from './ExerciseDragList';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextField } from '@/components/TextField';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { trainingApi } from '../api';
import { ExerciseDragHandle } from './ExerciseDragHandle';
import { ExerciseDetails } from './ExerciseDetails';
import { ExercisePicker } from './ExercisePicker';
import {
  routineInputSchema,
  type ExerciseSummary,
  type Routine,
  type RoutineInput,
  validWeight,
  type WeightUnit,
} from '../schemas';
import { WorkoutExerciseCard } from './WorkoutEditor';
import { SetFields } from './SetFields';
import { displayWeight } from '../sessionDraft';
import { Button, Failure, IconButton, ui } from './ui';

type DraftSet = { reps: string; weight: string; unit: WeightUnit; canonicalWeight?: string };
type DraftExercise = {
  slotId?: number;
  exercise: ExerciseSummary;
  sets: DraftSet[];
};
type Draft = { name: string; exercises: DraftExercise[] };

function SetSummary({ control, index }: Readonly<{ control: Control<Draft>; index: number }>) {
  const p = usePalette();
  const sets = useWatch({ control, name: `exercises.${index}.sets` }) ?? [];
  const range = (key: 'reps' | 'weight') => {
    const values = sets
      .map((set) => (set[key].trim() ? Number(summaryValue(key, set)) : Number.NaN))
      .filter(Number.isFinite);
    if (!values.length) return '—';
    const low = Math.min(...values),
      high = Math.max(...values);
    return low === high ? String(low) : `${low}–${high}`;
  };
  return (
    <View style={{ gap: spacing['space-2'] }}>
      <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
        {sets.length} {sets.length === 1 ? 'set' : 'sets'}
      </Text>
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        {range('reps')} reps · {range('weight')} kg
      </Text>
    </View>
  );
}

function summaryValue(key: 'reps' | 'weight', set: DraftSet) {
  if (key === 'weight') return displayWeight(set.weight, set.unit, 'kg');
  return set.reps;
}

function Sets({
  control,
  index,
  disabled,
}: Readonly<{
  control: Control<Draft>;
  index: number;
  disabled: boolean;
}>) {
  const p = usePalette();
  const unit: WeightUnit = 'kg';
  const { fields, append, remove } = useFieldArray({ control, name: `exercises.${index}.sets` });
  return (
    <View style={ui.gap}>
      <Text style={{ color: p['ink-muted'] }}>PLANNED SETS · WEIGHT / REPS</Text>
      {fields.map((set, i) => (
        <Controller
          key={set.id}
          control={control}
          name={`exercises.${index}.sets.${i}`}
          rules={{
            validate: (value) =>
              (validWeight(value.weight, value.unit, 2) &&
                /^\d+$/.test(value.reps) &&
                Number(value.reps) >= 1 &&
                Number(value.reps) <= 2147483647) ||
              'Enter nonnegative kg, up to two decimals.',
          }}
          render={({ field, fieldState }) => (
            <View style={ui.gap}>
              <SetFields
                set={{
                  id: set.id,
                  value: field.value.weight,
                  unit: field.value.unit,
                  reps: field.value.reps,
                }}
                unit={unit}
                decimals={2}
                number={i + 1}
                label={`Exercise ${index + 1} set ${i + 1}`}
                disabled={disabled}
                onChange={(next) =>
                  field.onChange({
                    weight: next.value,
                    unit: next.unit,
                    reps: next.reps,
                    ...(next.value === field.value.weight && next.unit === field.value.unit
                      ? { canonicalWeight: field.value.canonicalWeight }
                      : {}),
                  })
                }
                onRemove={() => remove(i)}
              />
              {fieldState.error ? (
                <Text accessibilityRole="alert" style={{ color: p.danger }}>
                  {fieldState.error.message}
                </Text>
              ) : null}
            </View>
          )}
        />
      ))}
      <Button
        title="+ Add set"
        accessibilityLabel={`Add set to exercise ${index + 1}`}
        onPress={() => append({ reps: '', weight: '', unit })}
        tone="positive"
        disabled={disabled || fields.length >= 100}
      />
    </View>
  );
}

export function RoutineEditor({
  accountId,
  routine,
  onSaved,
  onStart,
  canStart = true,
  onClose,
}: Readonly<{
  accountId: number;
  routine?: Routine;
  onSaved: (value: Routine) => void;
  onStart?: (value: Routine) => void;
  canStart?: boolean;
  onClose: () => void;
}>) {
  const p = usePalette();
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const alive = useRef(true);
  const startAfterSave = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const { control, handleSubmit, formState, setError, getValues } = useForm<Draft>({
    defaultValues: {
      name: routine?.name ?? '',
      exercises:
        routine?.exercises.map((slot) => ({
          slotId: slot.id,
          exercise: slot.exercise,
          sets: slot.default_sets.map((set) => ({
            reps: set.reps === null ? '' : String(set.reps),
            weight: set.weight_kg === null ? '' : Number(set.weight_kg).toFixed(2),
            unit: 'kg' as const,
            canonicalWeight: set.weight_kg ?? undefined,
          })),
        })) ?? [],
    },
  });
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'exercises',
  });
  const isDirty = formState.isDirty;
  const save = useMutation({
    mutationFn: (input: RoutineInput) => trainingApi.save(input, routine?.id),
    retry: false,
    onSuccess: (result) => {
      if (alive.current) {
        if (startAfterSave.current && onStart) onStart(result);
        else onSaved(result);
      }
    },
  });
  function close() {
    if (save.isPending) return;
    if (isDirty) setDiscard(true);
    else onClose();
  }
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!alive.current) return false;
      if (save.isPending) return true;
      if (isDirty) setDiscard(true);
      else onClose();
      return true;
    });
    return () => listener.remove();
  }, [isDirty, save.isPending, onClose]);
  const submit = handleSubmit((values) => {
    const parsed = routineInputSchema.safeParse({
      name: values.name,
      exercises: values.exercises.map((slot) => ({
        ...(slot.slotId === undefined ? {} : { id: slot.slotId }),
        exercise_id: slot.exercise.id,
        sets: slot.sets.map((set) => ({
          reps: Number(set.reps),
          ...setWeightInput(set),
        })),
      })),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues.find(
        (issue) => issue.path[0] === 'exercises' && typeof issue.path[1] === 'number',
      );
      if (issue && typeof issue.path[1] === 'number')
        setEditingSlot(fields[issue.path[1]]?.id ?? null);
      setError('root', {
        message: parsed.error.issues[0]?.message ?? 'Check the routine fields.',
      });
      return;
    }
    save.mutate(parsed.data);
  });
  const disabled = save.isPending || dragging;
  return (
    <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
      <KeyboardAvoidingView
        style={ui.screen}
        aria-hidden={discard}
        accessibilityElementsHidden={discard}
        importantForAccessibility={discard ? 'no-hide-descendants' : 'auto'}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <DraggableFlatList
          testID="routine-exercises"
          data={fields}
          keyExtractor={(slot) => slot.id}
          containerStyle={ui.screen}
          contentContainerStyle={ui.content}
          keyboardShouldPersistTaps="handled"
          activationDistance={8}
          onDragBegin={() => {
            Keyboard.dismiss();
            setDragging(true);
          }}
          onDragEnd={({ from, to }) => {
            if (from !== to) move(from, to);
            setDragging(false);
          }}
          ListHeaderComponent={
            <View style={ui.gap}>
              <View style={ui.row}>
                <IconButton
                  icon="arrow-left"
                  label="Back to routines"
                  onPress={close}
                  disabled={disabled}
                />
                <Text style={[ui.heading, { color: p.ink }]}>
                  {routine ? 'Edit routine' : 'New routine'}
                </Text>
              </View>
              <Text style={{ color: p.ink }}>Routine name</Text>
              <Controller
                control={control}
                name="name"
                rules={{
                  validate: (value) => value.trim().length > 0 || 'Enter a routine name.',
                  maxLength: {
                    value: 150,
                    message: 'Use at most 150 characters.',
                  },
                }}
                render={({ field, fieldState }) => (
                  <>
                    <TextField
                      accessibilityLabel="Routine name"
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      editable={!disabled}
                    />
                    {fieldState.error ? (
                      <Text accessibilityRole="alert" style={{ color: p.danger }}>
                        {fieldState.error.message}
                      </Text>
                    ) : null}
                  </>
                )}
              />
              <Text style={{ color: p['ink-muted'] }}>You can rename it later.</Text>
              <Text style={{ color: p['ink-muted'], fontWeight: '700' }}>
                EXERCISES · {fields.length}
              </Text>
              {fields.length > 1 ? (
                <Text style={{ color: p['ink-muted'] }}>Drag the ≡ handle to reorder.</Text>
              ) : null}
            </View>
          }
          renderItem={({ item: slot, getIndex, drag, isActive }) => {
            const index = getIndex();
            if (index === undefined) return null;
            return (
              <WorkoutExerciseCard
                exercise={slot.exercise}
                active={isActive}
                disabled={disabled}
                onSets={() => setEditingSlot(editingSlot === slot.id ? null : slot.id)}
                expanded={editingSlot === slot.id}
                onDetails={() => setDetailId(slot.exercise.id)}
                summary={<SetSummary control={control} index={index} />}
                dragHandle={
                  <ExerciseDragHandle
                    id={`reorder-handle-${slot.id}`}
                    label={`Reorder ${slot.exercise.name}`}
                    disabled={save.isPending}
                    onDrag={drag}
                    onMove={(delta) => {
                      if (disabled) return;
                      const target = index + delta;
                      if (target >= 0 && target < fields.length) move(index, target);
                    }}
                  />
                }
              >
                <Sets key={slot.id} control={control} index={index} disabled={save.isPending} />
                <Button
                  title="Remove"
                  accessibilityLabel={`Remove ${slot.exercise.name}`}
                  tone="danger"
                  onPress={() => {
                    remove(index);
                    setEditingSlot(null);
                  }}
                />
              </WorkoutExerciseCard>
            );
          }}
          ListFooterComponent={
            <View style={ui.gap}>
              <Button
                title="Add exercise"
                onPress={() => setPicker(true)}
                disabled={disabled || fields.length >= 500}
                tone="positive"
              />
              {formState.errors.root ? (
                <Text accessibilityRole="alert" style={{ color: p.danger }}>
                  {formState.errors.root.message}
                </Text>
              ) : null}
              {save.isError ? <Failure error={save.error} /> : null}
              <Button
                title={save.isPending ? 'Saving…' : 'Save'}
                onPress={() => {
                  startAfterSave.current = false;
                  void submit();
                }}
                disabled={disabled}
              />
              {onStart ? (
                <Button
                  title="Start routine"
                  disabled={disabled || !canStart}
                  onPress={() => {
                    if (routine && !isDirty) {
                      onStart(routine);
                      return;
                    }
                    startAfterSave.current = true;
                    void submit();
                  }}
                />
              ) : null}
            </View>
          }
        />
      </KeyboardAvoidingView>
      {picker ? (
        <ExercisePicker
          accountId={accountId}
          onClose={() => setPicker(false)}
          onSelect={(exercise) => {
            if (getValues('exercises').length >= 500) {
              Alert.alert('Routine limit', 'A routine can contain at most 500 exercises.');
              return;
            }
            append({ exercise, sets: [] });
            setPicker(false);
          }}
        />
      ) : null}
      {detailId !== null ? (
        <ExerciseDetails
          accountId={accountId}
          exerciseId={detailId}
          onClose={() => setDetailId(null)}
        />
      ) : null}
      <Modal
        visible={discard}
        transparent
        animationType="fade"
        onRequestClose={() => setDiscard(false)}
      >
        <View
          testID="discard-backdrop"
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
            backgroundColor: p.scrim,
          }}
        >
          <View
            accessibilityViewIsModal
            style={[
              ui.card,
              {
                backgroundColor: p['surface-200'],
                width: '100%',
                maxWidth: 420,
              },
            ]}
          >
            <Text accessibilityRole="alert" style={[ui.heading, { color: p.ink }]}>
              Discard your unsaved changes?
            </Text>
            <Text style={{ color: p['ink-muted'] }}>Your changes have not been saved.</Text>
            <Button title="Keep editing" onPress={() => setDiscard(false)} secondary />
            <Button title="Discard" onPress={onClose} tone="danger" />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function setWeightInput(set: DraftSet) {
  if (set.canonicalWeight !== undefined) return { weight_kg: set.canonicalWeight };
  if (set.unit === 'kg') return { weight_kg: set.weight };
  return { weight: { value: set.weight, unit: set.unit } };
}
