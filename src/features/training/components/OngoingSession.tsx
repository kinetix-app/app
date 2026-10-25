import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Modal, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, usePalette } from '@/theme/tokens';
import DraggableFlatList from '../ExerciseDragList';
import { ExerciseDragHandle } from '../ExerciseDragHandle';
import { ExerciseDetails } from '../ExerciseDetails';
import { ExercisePicker } from '../ExercisePicker';
import { displayWeight, emptyActualSet, type SessionDraft } from '../sessionDraft';
import type { ExerciseSummary } from '../schemas';
import { Button, IconButton, ui } from '../ui';
import { SetFields } from './SetFields';
import { WorkoutExerciseCard, WorkoutTimer } from './WorkoutEditor';
import { useSession } from './SessionProvider';

export function OngoingSession() {
  const session = useSession();
  const { draft, change } = session;
  const p = usePalette();
  const [picker, setPicker] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [finishPrompt, setFinishPrompt] = useState(false);
  const [failedAdd, setFailedAdd] = useState<ExerciseSummary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const pullStart = useRef<number | null>(null);
  const minimize = () => change((value) => ({ ...value, minimized: true }));
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      minimize();
      return true;
    });
    return () => listener.remove();
  });
  async function addExercise(exercise: ExerciseSummary) {
    setFailedAdd(null);
    const id = await session.addExercise(exercise);
    if (id) setSelected(id);
    else setFailedAdd(exercise);
  }
  if (!draft) return null;
  const locked = Boolean(draft.frozen) || session.pending;
  function editSlot(
    id: string,
    edit: (slot: SessionDraft['exercises'][number]) => SessionDraft['exercises'][number],
  ) {
    change((value) => ({
      ...value,
      exercises: value.exercises.map((slot) => (slot.id === id ? edit(slot) : slot)),
    }));
  }
  function renderSets(slot: SessionDraft['exercises'][number], index: number) {
    if (!draft) return null;
    return (
      <View style={ui.gap}>
        {slot.guidance.length ? (
          <Text style={{ color: p['ink-muted'] }}>
            Previous / planned:{' '}
            {slot.guidance[0].weightKg === null
              ? '—'
              : Number(displayWeight(slot.guidance[0].weightKg, 'kg', 'kg')).toFixed(2)}{' '}
            kg × {slot.guidance[0].reps ?? '—'} reps. Save each set with its tick.
          </Text>
        ) : null}
        {slot.sets.map((set, i) => (
          <React.Fragment key={set.id}>
            <SetFields
              label={`Exercise ${index + 1} set ${i + 1}`}
              set={set}
              number={i + 1}
              guidance={slot.guidance[i]}
              saved={set.saved}
              onConfirm={() => {
                const completesExercise =
                  !set.saved && slot.sets.every((other) => other.id === set.id || other.saved);
                void session.saveSet(slot.id, set.id).then((saved) => {
                  if (saved && completesExercise) {
                    const next = [
                      ...draft.exercises.slice(index + 1),
                      ...draft.exercises.slice(0, index),
                    ].find((exercise) => exercise.sets.some((set) => !set.saved));
                    setSelected(next?.id ?? null);
                  }
                });
              }}
              unit="kg"
              disabled={locked}
              onChange={(next) =>
                editSlot(slot.id, (value) => ({
                  ...value,
                  sets: value.sets.map((old) =>
                    old.id === set.id ? { ...next, saved: false } : old,
                  ),
                }))
              }
              onRemove={() =>
                editSlot(slot.id, (value) => ({
                  ...value,
                  sets: value.sets.filter((old) => old.id !== set.id),
                }))
              }
            />
            {i === slot.sets.findIndex((value) => !value.saved) ? (
              <Button
                title={`Record set ${i + 1}`}
                icon="camera"
                accessibilityLabel={`Record set ${i + 1} (coming soon)`}
                onPress={() => {}}
                tone="positive"
                disabled
              />
            ) : null}
          </React.Fragment>
        ))}
        <Button
          title="Add set"
          accessibilityLabel={`Add set to exercise ${index + 1}`}
          onPress={() =>
            editSlot(slot.id, (value) => ({
              ...value,
              sets: [...value.sets, emptyActualSet('kg')],
            }))
          }
          tone="positive"
          disabled={locked || slot.sets.length >= 100}
        />
        <Button
          title="Remove exercise"
          onPress={() => {
            change((value) => ({
              ...value,
              exercises: value.exercises.filter((old) => old.id !== slot.id),
            }));
            setSelected(null);
          }}
          tone="danger"
          disabled={locked}
        />
      </View>
    );
  }
  const header = (
    <View style={ui.gap}>
      <View
        testID="workout-pull-handle"
        accessibilityLabel="Pull down to minimize workout"
        onStartShouldSetResponder={() => !session.pending}
        onResponderTerminationRequest={() => false}
        onResponderGrant={({ nativeEvent }) => {
          pullStart.current = nativeEvent.pageY;
        }}
        onResponderRelease={({ nativeEvent }) => {
          if (
            pullStart.current !== null &&
            nativeEvent.pageY - pullStart.current > 64 &&
            !session.pending
          )
            minimize();
          pullStart.current = null;
        }}
        onResponderTerminate={() => {
          pullStart.current = null;
        }}
        style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          style={{
            width: 40,
            height: 4,
            borderRadius: radii['radius-pill'],
            backgroundColor: p['line-strong'],
          }}
        />
      </View>
      <View style={ui.row}>
        <Text accessibilityRole="header" style={[ui.heading, { color: p.ink, flex: 1 }]}>
          {draft.name}
        </Text>
        <IconButton
          icon="chevron-down"
          label="Minimize workout"
          onPress={minimize}
          disabled={session.pending}
        />
      </View>
      <WorkoutTimer startedAt={draft.startedAt} endedAt={draft.frozen?.ended_at} />
      {draft.frozen ? (
        <Text accessibilityRole="alert" style={{ color: p['ink-muted'] }}>
          Finished {new Date(draft.frozen.ended_at).toLocaleString()}. Results are locked for safe
          retry.
        </Text>
      ) : (
        <Text style={{ color: p['ink-muted'] }}>
          Record actual results. Guidance does not count as a recorded set.
        </Text>
      )}
      {session.error ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          {session.error}
        </Text>
      ) : null}
      <Button
        title={session.pending ? 'Working…' : 'Sync workout'}
        onPress={() => {
          void session.sync();
        }}
        secondary
        disabled={session.pending || Boolean(draft.frozen)}
      />
      {failedAdd ? (
        <Button
          title="Retry adding exercise"
          onPress={() => {
            void addExercise(failedAdd);
          }}
          secondary
          disabled={session.pending}
        />
      ) : null}
      {session.storageError ? (
        <Button
          title="Retry storage"
          onPress={() => {
            void session.retryStorage();
          }}
          secondary
        />
      ) : null}
    </View>
  );
  return (
    <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
      <KeyboardAvoidingView
        style={ui.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        aria-hidden={discard || finishPrompt}
        accessibilityElementsHidden={discard || finishPrompt}
        importantForAccessibility={discard || finishPrompt ? 'no-hide-descendants' : 'auto'}
      >
        <DraggableFlatList
          data={draft.exercises}
          keyExtractor={(item) => item.id}
          containerStyle={ui.screen}
          contentContainerStyle={ui.content}
          testID="session-exercises"
          keyboardShouldPersistTaps="handled"
          activationDistance={8}
          onScrollOffsetChange={(offset) => {
            if (offset < -80 && !session.pending && !dragging) minimize();
          }}
          onDragBegin={() => setDragging(true)}
          onDragEnd={({ from, to }) => {
            if (!locked)
              change((value) => {
                const exercises = [...value.exercises];
                exercises.splice(to, 0, ...exercises.splice(from, 1));
                return { ...value, exercises };
              });
            setDragging(false);
          }}
          ListHeaderComponent={header}
          renderItem={({ item, getIndex, drag, isActive }) => {
            const index = getIndex() ?? 0;
            return (
              <WorkoutExerciseCard
                exercise={item.exercise}
                active={isActive}
                disabled={session.pending || dragging}
                onSets={() => setSelected(selected === item.id ? null : item.id)}
                expanded={selected === item.id}
                onDetails={() => setDetails(item.exercise.id)}
                summary={
                  <Text style={{ color: p['ink-muted'] }}>
                    {item.sets.filter((set) => set.saved).length} / {item.sets.length} sets saved
                  </Text>
                }
                dragHandle={
                  <ExerciseDragHandle
                    id={`reorder-handle-${item.id}`}
                    label={`Reorder ${item.exercise.name}`}
                    disabled={locked}
                    onDrag={drag}
                    onMove={(delta) => {
                      const to = index + delta;
                      if (to >= 0 && to < draft.exercises.length)
                        change((value) => {
                          const exercises = [...value.exercises];
                          exercises.splice(to, 0, ...exercises.splice(index, 1));
                          return { ...value, exercises };
                        });
                    }}
                  />
                }
              >
                {renderSets(item, index)}
              </WorkoutExerciseCard>
            );
          }}
          ListFooterComponent={
            <View style={ui.gap}>
              {!draft.exercises.length ? (
                <Text style={{ color: p['ink-muted'] }}>Add exercises to record your workout.</Text>
              ) : null}
              <Button
                title="Add exercise"
                onPress={() => setPicker(true)}
                tone="positive"
                disabled={locked || dragging || draft.exercises.length >= 500}
              />
              <Button
                title={session.pending ? 'Working…' : draft.frozen ? 'Retry Finish' : 'Finish'}
                onPress={() => {
                  if (!draft.frozen && draft.routineId !== null) setFinishPrompt(true);
                  else void session.finish();
                }}
                disabled={session.pending || dragging || session.storageError}
              />
              <Button
                title="Discard workout"
                onPress={() => setDiscard(true)}
                tone="danger"
                disabled={locked || dragging}
              />
            </View>
          }
        />
      </KeyboardAvoidingView>
      {picker ? (
        <ExercisePicker
          accountId={session.accountId}
          onClose={() => setPicker(false)}
          onSelect={(exercise) => {
            setPicker(false);
            void addExercise(exercise);
          }}
        />
      ) : null}
      {details !== null ? (
        <ExerciseDetails
          accountId={session.accountId}
          exerciseId={details}
          onClose={() => setDetails(null)}
        />
      ) : null}
      <Modal
        visible={finishPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setFinishPrompt(false)}
      >
        <View
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
            <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
              Update the routine?
            </Text>
            <Text style={{ color: p['ink-muted'] }}>
              Finish this workout. Update the original routine with these exercises and saved sets,
              or keep its current plan. Unticked sets will be left out.
            </Text>
            <Button
              title="Keep routine"
              onPress={() => {
                setFinishPrompt(false);
                void session.finish(false);
              }}
              secondary
            />
            <Button
              title="Update routine"
              disabled={!draft.exercises.length}
              onPress={() => {
                setFinishPrompt(false);
                void session.finish(true);
              }}
            />
            <Button title="Cancel" onPress={() => setFinishPrompt(false)} secondary />
          </View>
        </View>
      </Modal>
      <Modal
        visible={discard}
        transparent
        animationType="fade"
        onRequestClose={() => setDiscard(false)}
      >
        <View
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
              Discard this workout?
            </Text>
            <Text style={{ color: p['ink-muted'] }}>
              The draft workout and its recorded results will be removed.
            </Text>
            <Button title="Keep recording" onPress={() => setDiscard(false)} secondary />
            <Button
              title="Discard"
              tone="danger"
              onPress={() => {
                setDiscard(false);
                void session.discard();
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
