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
      else setError('Could not start this workout. Try again or resume your active workout.');
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 404
          ? 'This shared workout is no longer available.'
          : 'Could not load this workout. Try again.',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function close() {
    if (!busy.current) onClose();
  }

  const partial = template && template.skipped_exercises.length > 0;
  const canPerform = Boolean(post.workout && workoutActions);
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
              Post options
            </Text>
            {post.is_mine ? (
              <Button title="Edit post · Coming soon" secondary disabled onPress={() => {}} />
            ) : null}
            {canPerform && workoutActions?.activeDraft ? (
              <>
                <Text style={{ color: p.ink }}>You already have an active workout.</Text>
                <Button
                  title="Resume active workout"
                  disabled={!workoutActions.available || pending}
                  onPress={() => {
                    onClose();
                    workoutActions.resume();
                  }}
                />
              </>
            ) : canPerform && template && !template.exercises.length ? (
              <Text accessibilityRole="alert" style={{ color: p.ink }}>
                None of the exercises in this workout are available to you.
              </Text>
            ) : canPerform && partial ? (
              <>
                <Text style={{ color: p.ink }}>
                  These exercises will be skipped: {template.skipped_exercises.join(', ')}.
                </Text>
                <Button
                  title="Start available exercises"
                  disabled={!workoutActions?.available || pending}
                  onPress={() => void perform(template)}
                />
              </>
            ) : canPerform ? (
              <Button
                title={post.is_mine ? 'Perform again' : 'Perform workout'}
                disabled={!workoutActions?.available || pending}
                onPress={() => void perform()}
              />
            ) : null}
            {pending ? <Text accessibilityRole="progressbar">Starting workout…</Text> : null}
            {error ? (
              <Text accessibilityRole="alert" style={{ color: p.danger }}>
                {error}
              </Text>
            ) : null}
            {post.is_mine ? (
              <Button
                title="Delete post"
                tone="danger"
                disabled={pending}
                onPress={() => onDelete(post)}
              />
            ) : null}
            <Button title="Close" secondary disabled={pending} onPress={close} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing['space-6'] },
  dialog: { width: '100%', maxWidth: 420, maxHeight: '90%', overflow: 'hidden' },
});
