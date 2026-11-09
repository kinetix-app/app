import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Modal, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, usePalette } from '@/theme/tokens';
import DraggableFlatList from './ExerciseDragList';
import { ActionMenu } from './ActionMenu';
import { ExerciseDetails } from './ExerciseDetails';
import { ExercisePicker } from './ExercisePicker';
import { emptyActualSet, type SessionDraft } from '../sessionDraft';
import { Button, ui } from './ui';
import { SetFields } from './SetFields';
import { WorkoutExerciseCard, WorkoutExerciseSummary, WorkoutTimer } from './WorkoutEditor';
import { useSession } from './SessionProvider';
import { FormCheckFlow, profileForExercise, useOptionalFormCheck } from '@/features/formcheck';

export function OngoingSession() {
  const session = useSession();
  const { draft, change } = session;
  const p = usePalette();
  const [picker, setPicker] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [finishPrompt, setFinishPrompt] = useState(false);
  const [actions, setActions] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const formCheck = useOptionalFormCheck();
  const [checking, setChecking] = useState<{
    exerciseName: string;
    setId: string;
    setNumber: number;
  } | null>(null);
  const pullStart = useRef<number | null>(null);
  const minimize = () => change((value) => ({ ...value, minimized: true }));
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      minimize();
      return true;
    });
    return () => listener.remove();
  });
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
  function updateSet(
    slotId: string,
    setId: string,
    next: SessionDraft['exercises'][number]['sets'][number],
  ) {
    editSlot(slotId, (value) => ({
      ...value,
      sets: value.sets.map((old) => (old.id === setId ? { ...next, saved: false } : old)),
    }));
  }
  function removeSet(slotId: string, setId: string) {
    editSlot(slotId, (value) => ({
      ...value,
      sets: value.sets.filter((old) => old.id !== setId),
    }));
  }
  async function confirmSet(slot: SessionDraft['exercises'][number], setId: string, index: number) {
    if (!draft) return;
    const set = slot.sets.find((value) => value.id === setId);
    if (!set) return;
    const completesExercise =
      !set.saved && slot.sets.every((other) => other.id === setId || other.saved);
    const saved = await session.saveSet(slot.id, setId);
    if (!saved || !completesExercise) return;
    const next = [...draft.exercises.slice(index + 1), ...draft.exercises.slice(0, index)].find(
      (exercise) => exercise.sets.some((value) => !value.saved),
    );
    setSelected(next?.id ?? null);
  }
  function renderSets(slot: SessionDraft['exercises'][number], index: number) {
    if (!draft) return null;
    return (
      <View style={ui.gap}>
        {slot.sets.map((set, i) => (
          <React.Fragment key={set.id}>
            <SetFields
              label={`Exercise ${index + 1} set ${i + 1}`}
              set={set}
              cardio={slot.exercise.activity_type === 'cardio'}
              number={i + 1}
              guidance={slot.guidance[i]}
              saved={set.saved}
              onConfirm={() => void confirmSet(slot, set.id, index)}
              unit="kg"
              disabled={locked}
              onChange={(next) => updateSet(slot.id, set.id, next)}
              onRemove={() => removeSet(slot.id, set.id)}
            />
            {formCheck && profileForExercise(slot.exercise.name)
              ? (() => {
                  const recorded = formCheck.entryFor(set.id);
                  if (!recorded && i !== slot.sets.findIndex((value) => !value.saved)) return null;
                  return (
                    <Button
                      title={recorded ? `Review set ${i + 1}` : `Record set ${i + 1}`}
                      icon={recorded ? 'eye' : 'camera'}
                      onPress={() =>
                        setChecking({
                          exerciseName: slot.exercise.name,
                          setId: set.id,
                          setNumber: i + 1,
                        })
                      }
                      tone="positive"
                      disabled={session.pending}
                    />
                  );
                })()
              : null}
          </React.Fragment>
        ))}
      </View>
    );
  }
  function finish() {
    if (!draft) return;
    if (!draft.frozen && draft.routineId !== null) setFinishPrompt(true);
    else void session.finish();
  }
  const header = (
    <View style={ui.gap}>
      <View
        testID="workout-pull-handle"
        accessibilityLabel="Pull down to minimize workout"
        accessibilityState={{ disabled: session.pending }}
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
        <View style={{ flex: 1, gap: 4 }}>
          <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
            {draft.name}
          </Text>
          <WorkoutTimer startedAt={draft.startedAt} endedAt={draft.frozen?.ended_at} compact />
        </View>
        <Button
          title={finishButtonTitle(session.pending, Boolean(draft.frozen))}
          onPress={finish}
          disabled={session.pending || dragging || session.storageError}
        />
      </View>
      {draft.frozen ? (
        <Text accessibilityRole="alert" style={{ color: p['ink-muted'] }}>
          Results are locked. Retry Finish to save your workout.
        </Text>
      ) : null}
      {draft.frozen ? (
        <Button
          title="Review locked sets"
          onPress={() => void session.recoverFrozen()}
          disabled={session.pending}
          secondary
        />
      ) : null}
      {session.error ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          {session.error}
        </Text>
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
        aria-hidden={
          discard || finishPrompt || actions || picker || details !== null || checking !== null
        }
        accessibilityElementsHidden={
          discard || finishPrompt || actions || picker || details !== null || checking !== null
        }
        importantForAccessibility={
          discard || finishPrompt || actions || picker || details !== null || checking !== null
            ? 'no-hide-descendants'
            : 'auto'
        }
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
                dragId={locked ? undefined : `reorder-card-${item.id}`}
                onDrag={locked ? undefined : drag}
                onMove={(delta) => {
                  const to = index + delta;
                  if (!locked && to >= 0 && to < draft.exercises.length)
                    change((value) => {
                      const exercises = [...value.exercises];
                      exercises.splice(to, 0, ...exercises.splice(index, 1));
                      return { ...value, exercises };
                    });
                }}
                active={isActive}
                disabled={locked || dragging}
                onSets={() => setSelected(selected === item.id ? null : item.id)}
                expanded={selected === item.id}
                onDetails={() => setDetails(item.exercise.id)}
                summary={
                  <WorkoutExerciseSummary
                    sets={item.sets}
                    cardio={item.exercise.activity_type === 'cardio'}
                    savedCount={item.sets.filter((set) => set.saved).length}
                  />
                }
                onRemove={() => {
                  change((value) => ({
                    ...value,
                    exercises: value.exercises.filter((slot) => slot.id !== item.id),
                  }));
                  if (selected === item.id) setSelected(null);
                }}
                onAddSet={() =>
                  editSlot(item.id, (value) => ({
                    ...value,
                    sets: [...value.sets, emptyActualSet('kg')],
                  }))
                }
                addSetLabel={`Add set to exercise ${index + 1}`}
                canAddSet={item.sets.length < 100}
                confirmSets
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
                title="More actions"
                icon="more-horizontal"
                onPress={() => setActions(true)}
                secondary
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
          maxSelection={500 - draft.exercises.length}
          onSelect={async (exercises) => {
            const added: number[] = [];
            for (const exercise of exercises) {
              const id = await session.addExercise(exercise);
              if (!id) break;
              added.push(exercise.id);
              setSelected(id);
            }
            return added;
          }}
        />
      ) : null}
      {actions ? (
        <ActionMenu
          title="Workout actions"
          onClose={() => setActions(false)}
          actions={[
            { title: 'Sync workout', onPress: () => void session.sync(), disabled: locked },
            {
              title: finishButtonTitle(false, Boolean(draft.frozen)),
              onPress: finish,
              disabled: session.storageError,
            },
            {
              title: 'Discard workout',
              onPress: () => setDiscard(true),
              tone: 'danger',
              disabled: locked,
            },
          ]}
        />
      ) : null}
      {checking && profileForExercise(checking.exerciseName) ? (
        <FormCheckFlow
          exerciseName={checking.exerciseName}
          profile={profileForExercise(checking.exerciseName)!}
          setId={checking.setId}
          setNumber={checking.setNumber}
          onClose={() => setChecking(null)}
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

function finishButtonTitle(pending: boolean, frozen: boolean) {
  if (pending) return 'Working…';
  return frozen ? 'Retry Finish' : 'Finish';
}
