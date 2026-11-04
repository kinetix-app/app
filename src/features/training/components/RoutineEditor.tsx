import React, { useEffect, useRef, useState } from 'react';
import { useForm, Controller, useFieldArray, useWatch, type Control } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Keyboard,
  Text,
  Pressable,
  View,
} from 'react-native';
import DraggableFlatList from './ExerciseDragList';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextField } from '@/components/TextField';
import { sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import {
  RoutinePictureEditor,
  routinePictureForm,
  type RoutinePictureDraft,
} from './RoutinePictureEditor';
import { trainingApi } from '../api';
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
import { WorkoutExerciseCard, WorkoutExerciseSummary } from './WorkoutEditor';
import { SetFields } from './SetFields';
import { Button, Failure, IconButton, ui } from './ui';

type DraftSet = { reps: string; weight: string; unit: WeightUnit; canonicalWeight?: string };
type DraftExercise = {
  slotId?: number;
  exercise: ExerciseSummary;
  sets: DraftSet[];
};
type Draft = { name: string; notes: string; exercises: DraftExercise[] };

function SetSummary({ control, index }: Readonly<{ control: Control<Draft>; index: number }>) {
  const sets = useWatch({ control, name: `exercises.${index}.sets` }) ?? [];
  return (
    <WorkoutExerciseSummary
      sets={sets.map((set) => ({ reps: set.reps, value: set.weight, unit: set.unit }))}
    />
  );
}

function RoutineExerciseEditor({
  control,
  index,
  ...card
}: Readonly<
  {
    control: Control<Draft>;
    index: number;
  } & Omit<
    React.ComponentProps<typeof WorkoutExerciseCard>,
    'summary' | 'onAddSet' | 'canAddSet' | 'children'
  >
>) {
  const p = usePalette();
  const unit: WeightUnit = 'kg';
  const { fields, append, remove } = useFieldArray({ control, name: `exercises.${index}.sets` });
  return (
    <WorkoutExerciseCard
      {...card}
      summary={<SetSummary control={control} index={index} />}
      onAddSet={() => append({ reps: '', weight: '', unit })}
      canAddSet={fields.length < 100}
    >
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
                disabled={card.disabled}
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
    </WorkoutExerciseCard>
  );
}

export function RoutineEditor({
  accountId,
  routine,
  onSaved,
  onClose,
}: Readonly<{
  accountId: number;
  routine?: Routine;
  onSaved: (value: Routine) => void;
  onClose: () => void;
}>) {
  const p = usePalette();
  const cache = useQueryClient();
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const alive = useRef(true);
  const [notesOpen, setNotesOpen] = useState(Boolean(routine?.notes));
  const [pictureDraft, setPictureDraft] = useState<RoutinePictureDraft>({ kind: 'keep' });
  const [pictureBusy, setPictureBusy] = useState(false);
  const savedRoutine = useRef<Routine | undefined>(routine);
  const appliedPicture = useRef<RoutinePictureDraft | undefined>(undefined);
  const [detailsSaved, setDetailsSaved] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const { control, handleSubmit, formState, setError, getValues } = useForm<Draft>({
    defaultValues: {
      name: routine?.name ?? '',
      notes: routine?.notes ?? '',
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
  const isDirty = formState.isDirty || pictureDraft.kind !== 'keep';
  const save = useMutation({
    mutationFn: async (input: RoutineInput) => {
      if (!routine) {
        const form =
          pictureDraft.kind === 'select' ? routinePictureForm(pictureDraft.asset) : new FormData();
        form.append('content', JSON.stringify(input));
        return trainingApi.create(form);
      }
      const result = await trainingApi.save(input, savedRoutine.current?.id ?? routine.id);
      savedRoutine.current = result;
      cache.setQueryData(['training', accountId, 'routine', result.id, 'kg'], result);
      void cache.invalidateQueries({ queryKey: ['training', accountId, 'routines'] });
      setDetailsSaved(true);
      if (appliedPicture.current === pictureDraft || pictureDraft.kind === 'keep') return result;
      const withPicture =
        pictureDraft.kind === 'select'
          ? await trainingApi.uploadPicture(result.id, routinePictureForm(pictureDraft.asset))
          : await trainingApi.removePicture(result.id);
      appliedPicture.current = pictureDraft;
      savedRoutine.current = withPicture;
      return withPicture;
    },
    retry: false,
    onSuccess: (result) => {
      if (alive.current) onSaved(result);
    },
  });
  function close() {
    if (save.isPending || pictureBusy) return;
    if (isDirty) setDiscard(true);
    else onClose();
  }
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!alive.current) return false;
      if (save.isPending || pictureBusy) return true;
      if (isDirty) setDiscard(true);
      else onClose();
      return true;
    });
    return () => listener.remove();
  }, [isDirty, save.isPending, pictureBusy, onClose]);
  const submit = handleSubmit((values) => {
    const parsed = routineInputSchema.safeParse({
      name: values.name,
      notes: values.notes.trim() || null,
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
  const disabled = save.isPending || dragging || pictureBusy;
  return (
    <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
      <KeyboardAvoidingView
        style={ui.screen}
        aria-hidden={discard}
        accessibilityElementsHidden={discard}
        importantForAccessibility={discard ? 'no-hide-descendants' : 'auto'}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[ui.row, { padding: spacing['space-4'] }]}>
          <IconButton
            icon="arrow-left"
            label="Back to routines"
            onPress={close}
            disabled={disabled}
          />
          <Text accessibilityRole="header" style={[ui.heading, { flex: 1, color: p.ink }]}>
            {routine ? 'Edit routine' : 'New routine'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save routine"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => void submit()}
            style={({ pressed }) => ({
              minHeight: sizes['tap-min'],
              minWidth: sizes['tap-min'],
              justifyContent: 'center',
              alignItems: 'center',
              opacity: disabled || pressed ? 0.55 : 1,
            })}
          >
            <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </View>
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
                      placeholder="Name your routine"
                      maxLength={150}
                      inputStyle={textStyles['title-lg']}
                      containerStyle={{
                        backgroundColor: p['surface-100'],
                        borderWidth: 0,
                        borderBottomWidth: 1,
                        borderRadius: 0,
                        paddingHorizontal: 0,
                      }}
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={notesOpen ? 'Hide routine notes' : 'Add routine notes'}
                accessibilityState={{ expanded: notesOpen, disabled }}
                disabled={disabled}
                onPress={() => setNotesOpen(!notesOpen)}
                style={{ minHeight: sizes['tap-min'], justifyContent: 'center' }}
              >
                <Text style={[textStyles.label, { color: p['ink-muted'] }]}>
                  {notesOpen ? 'Notes (optional) −' : '+ Add notes'}
                </Text>
              </Pressable>
              {notesOpen ? (
                <Controller
                  control={control}
                  name="notes"
                  rules={{ maxLength: { value: 1000, message: 'Use at most 1000 characters.' } }}
                  render={({ field, fieldState }) => (
                    <View style={ui.gap}>
                      <TextField
                        accessibilityLabel="Routine notes"
                        placeholder="Focus, reminders or a plan for this routine…"
                        value={field.value}
                        onChangeText={field.onChange}
                        onBlur={field.onBlur}
                        editable={!disabled}
                        multiline
                        maxLength={1000}
                        inputStyle={{ minHeight: 64, textAlignVertical: 'top' }}
                      />
                      <Text
                        style={[
                          textStyles['body-sm'],
                          { color: p['ink-muted'], textAlign: 'right' },
                        ]}
                      >
                        {field.value.length}/1000
                      </Text>
                      {fieldState.error ? (
                        <Text accessibilityRole="alert" style={{ color: p.danger }}>
                          {fieldState.error.message}
                        </Text>
                      ) : null}
                    </View>
                  )}
                />
              ) : null}
              <RoutinePictureEditor
                accountId={accountId}
                routineId={routine?.id}
                path={routine?.image_url}
                draft={pictureDraft}
                onChange={setPictureDraft}
                onBusy={setPictureBusy}
                disabled={disabled}
              />
              <Text style={{ color: p['ink-muted'], fontWeight: '700' }}>
                EXERCISES · {fields.length}
              </Text>
            </View>
          }
          renderItem={({ item: slot, getIndex, drag, isActive }) => {
            const index = getIndex();
            if (index === undefined) return null;
            return (
              <RoutineExerciseEditor
                control={control}
                index={index}
                exercise={slot.exercise}
                active={isActive}
                dragId={save.isPending || pictureBusy ? undefined : `reorder-card-${slot.id}`}
                onDrag={save.isPending || pictureBusy ? undefined : drag}
                onMove={(delta) => {
                  if (disabled) return;
                  const target = index + delta;
                  if (target >= 0 && target < fields.length) move(index, target);
                }}
                onRemove={() => {
                  remove(index);
                  if (editingSlot === slot.id) setEditingSlot(null);
                }}
                addSetLabel={`Add set to exercise ${index + 1}`}
                disabled={disabled}
                onSets={() => setEditingSlot(editingSlot === slot.id ? null : slot.id)}
                expanded={editingSlot === slot.id}
                onDetails={() => setDetailId(slot.exercise.id)}
              />
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
              {save.isError ? (
                <View style={ui.gap}>
                  {detailsSaved ? (
                    <Text accessibilityRole="alert" style={{ color: p.danger }}>
                      Routine details saved. Your cover change could not be saved. Save again to
                      retry, or go back to keep the saved details.
                    </Text>
                  ) : null}
                  <Failure error={save.error} />
                </View>
              ) : null}
            </View>
          }
        />
      </KeyboardAvoidingView>
      {picker ? (
        <ExercisePicker
          accountId={accountId}
          onClose={() => setPicker(false)}
          maxSelection={500 - getValues('exercises').length}
          onSelect={(exercises) => {
            const available = exercises.slice(0, 500 - getValues('exercises').length);
            append(available.map((exercise) => ({ exercise, sets: [] })));
            return available.map((exercise) => exercise.id);
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
              {detailsSaved ? 'Discard remaining changes?' : 'Discard your unsaved changes?'}
            </Text>
            <Text style={{ color: p['ink-muted'] }}>
              {detailsSaved
                ? 'Previously saved routine details will be kept. Any remaining edits will be discarded.'
                : 'Your changes have not been saved.'}
            </Text>
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
