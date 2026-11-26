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
      else
        setError(
          language === 'es'
            ? 'No se pudo iniciar el entrenamiento. Inténtalo de nuevo o reanuda tu entrenamiento activo.'
            : 'Could not start this workout. Try again or resume your active workout.',
        );
    } catch (error_) {
      setError(
        error_ instanceof ApiError && error_.status === 404
          ? language === 'es'
            ? 'Este entrenamiento compartido ya no está disponible.'
            : 'This shared workout is no longer available.'
          : language === 'es'
            ? 'No se pudo cargar el entrenamiento. Inténtalo de nuevo.'
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
              {language === 'es' ? 'Opciones de la publicación' : 'Post options'}
            </Text>
            {post.is_mine ? (
              <Button
                title={
                  language === 'es'
                    ? 'Editar publicación · Próximamente'
                    : 'Edit post · Coming soon'
                }
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
                {language === 'es' ? 'Iniciando entrenamiento…' : 'Starting workout…'}
              </Text>
            ) : null}
            {error ? (
              <Text accessibilityRole="alert" style={{ color: p.danger }}>
                {error}
              </Text>
            ) : null}
            {post.is_mine ? (
              <Button
                title={language === 'es' ? 'Eliminar publicación' : 'Delete post'}
                tone="danger"
                disabled={pending}
                onPress={() => onDelete(post)}
              />
            ) : null}
            <Button
              title={language === 'es' ? 'Cerrar' : 'Close'}
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
          {language === 'es'
            ? 'Ya tienes un entrenamiento activo.'
            : 'You already have an active workout.'}
        </Text>
        <Button
          title={language === 'es' ? 'Reanudar entrenamiento activo' : 'Resume active workout'}
          disabled={disabled}
          onPress={onResume}
        />
      </>
    );
  }
  if (template && !template.exercises.length) {
    return (
      <Text accessibilityRole="alert" style={{ color: p.ink }}>
        {language === 'es'
          ? 'Ninguno de los ejercicios de este entrenamiento está disponible para ti.'
          : 'None of the exercises in this workout are available to you.'}
      </Text>
    );
  }
  if (template?.skipped_exercises.length) {
    return (
      <>
        <Text style={{ color: p.ink }}>
          {language === 'es' ? 'Se omitirán estos ejercicios' : 'These exercises will be skipped'}:{' '}
          {template.skipped_exercises.join(', ')}.
        </Text>
        <Button
          title={language === 'es' ? 'Iniciar ejercicios disponibles' : 'Start available exercises'}
          disabled={disabled}
          onPress={() => onPerform(template)}
        />
      </>
    );
  }
  return (
    <Button
      title={
        mine
          ? language === 'es'
            ? 'Volver a realizar'
            : 'Perform again'
          : language === 'es'
            ? 'Realizar entrenamiento'
            : 'Perform workout'
      }
      disabled={disabled}
      onPress={() => onPerform()}
    />
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing['space-6'] },
  dialog: { width: '100%', maxWidth: 420, maxHeight: '90%', overflow: 'hidden' },
});
