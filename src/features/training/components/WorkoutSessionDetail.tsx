import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/services/apiClient';
import { usePalette } from '@/theme/tokens';
import { trainingApi } from '../api';
import { formatCardioDuration } from '../cardio';
import type { CompletedSession } from '../schemas';
import { Button, Failure, IconButton, Loading, ui } from './ui';
import { WorkoutExerciseList } from './WorkoutExerciseList';

type WorkoutSessionDetailProps = Readonly<{
  accountId: number;
  sessionId: number;
  onBack: () => void;
  backLabel: string;
  onShare?: (id: number) => void;
}>;

const weightUnit = 'kg';

export function WorkoutSessionDetail({
  accountId,
  sessionId,
  onBack,
  backLabel,
  onShare,
}: WorkoutSessionDetailProps) {
  const p = usePalette();
  const detail = useQuery({
    queryKey: ['training', accountId, 'session', sessionId, weightUnit],
    queryFn: ({ signal }) => trainingApi.session(sessionId, weightUnit, signal),
  });
  const session = detail.data;

  return (
    <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
      <ScrollView contentContainerStyle={ui.content}>
        <View style={ui.row}>
          <IconButton icon="arrow-left" label={backLabel} onPress={onBack} />
          <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
            Workout
          </Text>
        </View>
        {detail.isPending ? <Loading /> : null}
        {detail.isError ? (
          detail.error instanceof ApiError && detail.error.status === 404 ? (
            <Text accessibilityRole="alert" style={{ color: p.danger }}>
              This workout is no longer available.
            </Text>
          ) : (
            <Failure error={detail.error} retry={() => void detail.refetch()} />
          )
        ) : null}
        {!detail.isError && session ? (
          <>
            <View style={ui.gap}>
              <Text style={{ color: p.ink }}>
                Completed {new Date(session.ended_at).toLocaleString()}
              </Text>
              <Text style={{ color: p['ink-muted'] }}>
                Started {new Date(session.started_at).toLocaleString()}
              </Text>
            </View>
            <WorkoutExerciseList
              exercises={session.exercises.map((slot) => ({
                id: slot.id,
                name: `${slot.exercise_order}. ${slot.exercise.name}`,
                sets: slot.sets.map((set) => ({
                  number: set.set_number,
                  result: formatWorkoutSet(set),
                })),
              }))}
            />
            {onShare ? (
              <Button
                title="Share to feed"
                tone="positive"
                icon="share"
                onPress={() => onShare(sessionId)}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export function WorkoutSessionDetailModal(props: WorkoutSessionDetailProps) {
  return (
    <Modal animationType="slide" onRequestClose={props.onBack}>
      <WorkoutSessionDetail {...props} />
    </Modal>
  );
}

function formatWorkoutSet(set: CompletedSession['exercises'][number]['sets'][number]) {
  if (set.duration_seconds !== null || set.distance_km !== null) {
    const duration =
      set.duration_seconds === null ? '—' : formatCardioDuration(set.duration_seconds);
    return `${set.distance_km ?? '—'} km · ${duration}`;
  }
  return `${set.weight?.value ?? '—'} ${set.weight?.unit ?? weightUnit} · ${set.reps ?? '—'} reps`;
}
