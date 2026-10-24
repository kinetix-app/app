import React, { useEffect, useRef, useState } from 'react';
import { useForm, Controller, useFieldArray, useWatch, type Control } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  ScrollView,
  Pressable,
  Keyboard,
  Text,
  TextInput,
  View,
} from 'react-native';
import DraggableFlatList from './ExerciseDragList';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { trainingApi } from './api';
import { ExerciseDragHandle } from './ExerciseDragHandle';
import { ExerciseDetails } from './ExerciseDetails';
import { ExercisePicker } from './ExercisePicker';
import {
  routineInputSchema,
  type ExerciseSummary,
  type Routine,
  type RoutineInput,
} from './schemas';
import { Button, Failure, IconButton, ui } from './ui';

type DraftSet = { reps: string; weight: string };
type DraftExercise = { slotId?: number; exercise: ExerciseSummary; sets: DraftSet[] };
type Draft = { name: string; exercises: DraftExercise[] };

function SetSummary({ control, index }: { control: Control<Draft>; index: number }) {
  const p = usePalette();
  const sets = useWatch({ control, name: `exercises.${index}.sets` }) ?? [];
  const range = (key: 'reps' | 'weight') => {
    const values = sets
      .map((set) => (set[key].trim() ? Number(set[key]) : NaN))
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

function Sets({
  control,
  index,
  disabled,
}: {
  control: Control<Draft>;
  index: number;
  disabled: boolean;
}) {
  const p = usePalette();
  const { fields, append, remove } = useFieldArray({ control, name: `exercises.${index}.sets` });
  return (
    <View style={ui.gap}>
      <Text style={{ color: p['ink-muted'] }}>PLANNED SETS · KG / REPS</Text>
      {fields.map((set, i) => (
        <View key={set.id} style={ui.gap}>
          <View style={ui.row}>
            <Text style={{ color: p.ink }}>{i + 1}</Text>
            <Controller
              control={control}
              name={`exercises.${index}.sets.${i}.weight`}
              rules={{
                validate: (v) =>
                  (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 999999.99) ||
                  'Enter nonnegative kg, up to two decimals.',
              }}
              render={({ field, fieldState }) => (
                <View style={{ flex: 1 }}>
                  <TextInput
                    accessibilityLabel={`Exercise ${index + 1} set ${i + 1} kg`}
                    keyboardType="decimal-pad"
                    editable={!disabled}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="kg"
                    placeholderTextColor={p['ink-muted']}
                    style={[
                      ui.field,
                      {
                        color: p.ink,
                        borderColor: p['line-strong'],
                        backgroundColor: p['surface-300'],
                      },
                    ]}
                  />
                  {fieldState.error ? (
                    <Text accessibilityRole="alert" style={{ color: p.danger }}>
                      {fieldState.error.message}
                    </Text>
                  ) : null}
                </View>
              )}
            />
            <Controller
              control={control}
              name={`exercises.${index}.sets.${i}.reps`}
              rules={{
                validate: (v) =>
                  (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 2147483647) ||
                  'Enter positive whole repetitions.',
              }}
              render={({ field, fieldState }) => (
                <View style={{ flex: 1 }}>
                  <TextInput
                    accessibilityLabel={`Exercise ${index + 1} set ${i + 1} reps`}
                    keyboardType="number-pad"
                    editable={!disabled}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="reps"
                    placeholderTextColor={p['ink-muted']}
                    style={[
                      ui.field,
                      {
                        color: p.ink,
                        borderColor: p['line-strong'],
                        backgroundColor: p['surface-300'],
                      },
                    ]}
                  />
                  {fieldState.error ? (
                    <Text accessibilityRole="alert" style={{ color: p.danger }}>
                      {fieldState.error.message}
                    </Text>
                  ) : null}
                </View>
              )}
            />
            <Button
              title="−"
              accessibilityLabel={`Remove set ${i + 1} from exercise ${index + 1}`}
              onPress={() => remove(i)}
              secondary
              disabled={disabled}
            />
          </View>
        </View>
      ))}
      <Button
        title="+ Add set"
        accessibilityLabel={`Add set to exercise ${index + 1}`}
        onPress={() => append({ reps: '', weight: '' })}
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
  onClose,
}: {
  accountId: number;
  routine?: Routine;
  onSaved: (value: Routine) => void;
  onClose: () => void;
}) {
  const p = usePalette();
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const { control, handleSubmit, formState, setError, getValues, trigger } = useForm<Draft>({
    defaultValues: {
      name: routine?.name ?? '',
      exercises:
        routine?.exercises.map((slot) => ({
          slotId: slot.id,
          exercise: slot.exercise,
          sets: slot.default_sets.map((set) => ({
            reps: set.reps === null ? '' : String(set.reps),
            weight: set.weight_kg ?? '',
          })),
        })) ?? [],
    },
  });
  const { fields, append, remove, move } = useFieldArray({ control, name: 'exercises' });
  const editingIndex = fields.findIndex((slot) => slot.id === editingSlot);
  const editingExercise = fields[editingIndex];
  const isDirty = formState.isDirty;
  const save = useMutation({
    mutationFn: (input: RoutineInput) => trainingApi.save(input, routine?.id),
    retry: false,
    onSuccess: (result) => {
      if (alive.current) onSaved(result);
    },
  });
  function close() {
    if (save.isPending) return;
    if (isDirty) setDiscard(true);
    else onClose();
  }
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
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
        sets: slot.sets.map((set) => ({ reps: Number(set.reps), weight_kg: set.weight })),
      })),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues.find(
        (issue) => issue.path[0] === 'exercises' && typeof issue.path[1] === 'number',
      );
      if (issue && typeof issue.path[1] === 'number')
        setEditingSlot(fields[issue.path[1]]?.id ?? null);
      setError('root', { message: parsed.error.issues[0]?.message ?? 'Check the routine fields.' });
      return;
    }
    save.mutate(parsed.data);
  });
  const disabled = save.isPending || dragging;
  return (
    <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
      <KeyboardAvoidingView
        style={ui.screen}
        accessibilityElementsHidden={discard || editingSlot !== null}
        importantForAccessibility={discard || editingSlot !== null ? 'no-hide-descendants' : 'auto'}
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
                  maxLength: { value: 150, message: 'Use at most 150 characters.' },
                }}
                render={({ field, fieldState }) => (
                  <>
                    <TextInput
                      accessibilityLabel="Routine name"
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      editable={!disabled}
                      style={[
                        ui.field,
                        {
                          backgroundColor: p['surface-300'],
                          color: p.ink,
                          borderColor: p['line-strong'],
                        },
                      ]}
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
              <View
                style={[
                  ui.card,
                  {
                    backgroundColor: isActive ? p['surface-300'] : p['surface-200'],
                    borderWidth: 1,
                    borderColor: isActive ? p.brand : p['surface-200'],
                  },
                ]}
              >
                <View style={[ui.row, { alignItems: 'stretch' }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Details for ${slot.exercise.name}`}
                    onPress={() => setDetailId(slot.exercise.id)}
                    disabled={disabled}
                    style={{
                      width: '38%',
                      minHeight: 132,
                      borderRadius: radii['radius-md'],
                      backgroundColor: p['surface-300'],
                      overflow: 'hidden',
                    }}
                  >
                    {slot.exercise.image_url ? (
                      <Image
                        source={{ uri: slot.exercise.image_url }}
                        accessibilityLabel={slot.exercise.name}
                        resizeMode="contain"
                        style={{ width: '100%', height: 132 }}
                      />
                    ) : (
                      <View style={{ flex: 1, justifyContent: 'center', padding: 12 }}>
                        <Text style={{ color: p['ink-muted'] }}>No image</Text>
                      </View>
                    )}
                  </Pressable>
                  <View style={{ flex: 1, gap: spacing['space-2'] }}>
                    <View style={[ui.row, { alignItems: 'flex-start' }]}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit sets for ${slot.exercise.name}`}
                        onPress={() => setEditingSlot(slot.id)}
                        disabled={disabled}
                        style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
                      >
                        <Text style={[textStyles['title-md'], { color: p.ink }]}>
                          {slot.exercise.name}
                        </Text>
                      </Pressable>
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
                    </View>
                    <SetSummary control={control} index={index} />
                    <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                      Tap name to edit sets
                    </Text>
                  </View>
                </View>
              </View>
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
                  void submit();
                }}
                disabled={disabled}
              />
            </View>
          }
        />
      </KeyboardAvoidingView>
      {editingExercise ? (
        <Modal onRequestClose={() => setEditingSlot(null)} animationType="slide">
          <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
            <KeyboardAvoidingView
              style={ui.screen}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
                <View style={ui.row}>
                  <IconButton
                    icon="arrow-left"
                    label="Back to routine"
                    onPress={() => setEditingSlot(null)}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[textStyles.overline, { color: p['ink-muted'] }]}>
                      EXERCISE {editingIndex + 1} OF {fields.length}
                    </Text>
                    <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
                      {editingExercise.exercise.name}
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Details for ${editingExercise.exercise.name}`}
                  onPress={() => setDetailId(editingExercise.exercise.id)}
                >
                  {editingExercise.exercise.image_url ? (
                    <Image
                      source={{ uri: editingExercise.exercise.image_url }}
                      style={{ width: '100%', height: 180, borderRadius: radii['radius-lg'] }}
                      resizeMode="contain"
                    />
                  ) : null}
                  <Text
                    style={[
                      textStyles.label,
                      { color: p['brand-ink'], paddingVertical: spacing['space-3'] },
                    ]}
                  >
                    View exercise
                  </Text>
                </Pressable>
                <View style={[ui.card, { backgroundColor: p['surface-200'] }]}>
                  <Sets
                    key={editingExercise.id}
                    control={control}
                    index={editingIndex}
                    disabled={save.isPending}
                  />
                </View>
                <Button
                  title="Done"
                  onPress={() => {
                    void trigger(`exercises.${editingIndex}.sets`).then((valid) => {
                      if (valid) setEditingSlot(null);
                    });
                  }}
                />
                <Button
                  title="Remove"
                  accessibilityLabel={`Remove ${editingExercise.exercise.name}`}
                  tone="danger"
                  onPress={() => {
                    remove(editingIndex);
                    setEditingSlot(null);
                  }}
                />
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      ) : null}
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
            style={[ui.card, { backgroundColor: p['surface-200'], width: '100%', maxWidth: 420 }]}
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
