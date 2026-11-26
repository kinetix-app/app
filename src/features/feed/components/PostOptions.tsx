import { getTranslation } from '@/i18n/catalog';
import { useLanguage } from '@/i18n/Language';
import React, { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, ui } from '@/features/training/components/ui';
import type { SharedWorkoutSeed } from '@/features/training/sessionDraft';
import { ApiError } from '@/services/apiClient';
import { spacing, usePalette } from '@/theme/tokens';
import { feedApi } from '../api';
import type { Post, WorkoutTemplate } from '../schemas';

export type WorkoutActions = Readonly<{
  activeDraft: boolean;
  expandedDraft: boolean;
  available: boolean;
  start: (seed: SharedWorkoutSeed) => Promise<boolean>;
  resume: () => void;
}>;

function workoutError(error: unknown, language: 'en' | 'es') {
  if (error instanceof ApiError && error.status === 404)
    return getTranslation(language)('feed.thisSharedWorkoutIsNoLongerAvailable');
  return getTranslation(language)('feed.couldNotLoadThisWorkoutTryAgain');
}

function startError(language: 'en' | 'es') {
  return getTranslation(language)('feed.couldNotStartThisWorkoutTryAgain');
}

export function PostOptions({
  post,
  onClose,
  onDelete,
  workoutActions,
}: Readonly<{
  post: Post;
  onClose: () => void;
  onDelete: (post: Post) => void;
  workoutActions?: WorkoutActions;
}>) {
  const language = useLanguage();
  const p = usePalette();
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  async function perform(accepted?: WorkoutTemplate) {
    if (!workoutActions?.available || workoutActions.activeDraft || busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const workout = accepted ?? (await feedApi.workoutTemplate(post.id));
      setTemplate(workout);
      if (!workout.exercises.length || (!accepted && workout.skipped_exercises.length)) return;
      if (await workoutActions.start(workout)) onClose();
      else setError(startError(language));
    } catch (error_) {
      setError(workoutError(error_, language));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function close() {
    if (!busy.current) onClose();
  }

  return (
    <Modal
      visible={!workoutActions?.expandedDraft}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={[styles.scrim, { backgroundColor: p.scrim }]}>
        <View
          accessibilityViewIsModal
          style={[styles.dialog, { backgroundColor: p['surface-200'] }]}
        >
          <ScrollView contentContainerStyle={ui.card}>
            <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
              {getTranslation(language)('feed.postOptions')}
            </Text>
            {post.is_mine ? (
              <Button
                title={getTranslation(language)('feed.editPostComingSoon')}
                secondary
                disabled
                onPress={() => {}}
              />
            ) : null}
            {post.workout && workoutActions ? (
              <PerformAction
                mine={post.is_mine}
                activeDraft={workoutActions.activeDraft}
                disabled={!workoutActions.available || pending}
                template={template}
                onPerform={(accepted) => void perform(accepted)}
                onResume={() => {
                  onClose();
                  workoutActions.resume();
                }}
              />
            ) : null}
            {pending ? (
              <Text accessibilityRole="progressbar">
                {getTranslation(language)('feed.startingWorkout')}
              </Text>
            ) : null}
            {error ? (
              <Text accessibilityRole="alert" style={{ color: p.danger }}>
                {error}
              </Text>
            ) : null}
            {post.is_mine ? (
              <Button
                title={getTranslation(language)('feed.deletePost')}
                tone="danger"
                disabled={pending}
                onPress={() => onDelete(post)}
              />
            ) : null}
            <Button
              title={getTranslation(language)('feed.close')}
              secondary
              disabled={pending}
              onPress={close}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PerformAction({
  mine,
  activeDraft,
  disabled,
  template,
  onPerform,
  onResume,
}: Readonly<{
  mine: boolean;
  activeDraft: boolean;
  disabled: boolean;
  template: WorkoutTemplate | null;
  onPerform: (accepted?: WorkoutTemplate) => void;
  onResume: () => void;
}>) {
  const language = useLanguage();
  const p = usePalette();
  if (activeDraft) {
    return (
      <>
        <Text style={{ color: p.ink }}>
          {getTranslation(language)('feed.youAlreadyHaveAnActiveWorkout')}
        </Text>
        <Button
          title={getTranslation(language)('feed.resumeActiveWorkout')}
          disabled={disabled}
          onPress={onResume}
        />
      </>
    );
  }
  if (template && !template.exercises.length) {
    return (
      <Text accessibilityRole="alert" style={{ color: p.ink }}>
        {getTranslation(language)('feed.noneOfTheExercisesInThisWorkout')}
      </Text>
    );
  }
  if (template?.skipped_exercises.length) {
    return (
      <>
        <Text style={{ color: p.ink }}>
          {getTranslation(language)('feed.theseExercisesWillBeSkipped')}:{' '}
          {template.skipped_exercises.join(', ')}.
        </Text>
        <Button
          title={getTranslation(language)('feed.startAvailableExercises')}
          disabled={disabled}
          onPress={() => onPerform(template)}
        />
      </>
    );
  }
  return (
    <Button title={performTitle(mine, language)} disabled={disabled} onPress={() => onPerform()} />
  );
}

function performTitle(mine: boolean, language: 'en' | 'es') {
  if (mine) return getTranslation(language)('feed.performAgain');
  return getTranslation(language)('feed.performWorkout');
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing['space-6'] },
  dialog: { width: '100%', maxWidth: 420, maxHeight: '90%', overflow: 'hidden' },
});
