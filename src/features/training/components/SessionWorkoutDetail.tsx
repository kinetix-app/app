import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { Modal } from 'react-native';
import { trainingApi } from '../api';
import { formatCardioDuration } from '../cardio';
import type { CompletedSession } from '../schemas';
import { WorkoutDetail, type WorkoutDetailData } from './WorkoutDetail';

type SessionWorkoutDetailProps = Readonly<{
  accountId: number;
  sessionId: number;
  onBack: () => void;
  backLabel: string;
  showShare?: boolean;
  onShare?: (sessionId: number) => void;
}>;

const weightUnit = 'kg';

export function SessionWorkoutDetail({
  accountId,
  sessionId,
  onBack,
  backLabel,
  showShare,
  onShare,
}: SessionWorkoutDetailProps) {
  const detail = useQuery({
    queryKey: ['training', accountId, 'session', sessionId, weightUnit],
    queryFn: ({ signal }) => trainingApi.session(sessionId, weightUnit, signal),
    select: sessionDetail,
  });
  return (
    <WorkoutDetail
      workout={detail.isSuccess ? detail.data : undefined}
      error={detail.error}
      onRetry={() => void detail.refetch()}
      onBack={onBack}
      backLabel={backLabel}
      showShare={showShare}
      onShare={onShare ? () => onShare(sessionId) : undefined}
    />
  );
}

export function SessionWorkoutDetailModal(props: SessionWorkoutDetailProps) {
  return (
    <Modal animationType="slide" onRequestClose={props.onBack}>
      <SessionWorkoutDetail {...props} />
    </Modal>
  );
}

function sessionDetail(session: CompletedSession): WorkoutDetailData {
  return {
    title: session.title,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    volumeKg: session.total_volume_kg,
    reps: session.total_reps,
    exercises: session.exercises.map((slot) => ({
      id: slot.id,
      name: slot.exercise.name,
      imageUrl: slot.exercise.image_url,
      sets: slot.sets.map((set) => ({ number: set.set_number, result: formatWorkoutSet(set) })),
    })),
  };
}

function formatWorkoutSet(set: CompletedSession['exercises'][number]['sets'][number]) {
  if (set.duration_seconds !== null || set.distance_km !== null) {
    const duration =
      set.duration_seconds === null ? '—' : formatCardioDuration(set.duration_seconds);
    return `${set.distance_km ?? '—'} km · ${duration}`;
  }
  return `${set.weight?.value ?? '—'} ${set.weight?.unit ?? weightUnit} · ${set.reps ?? '—'} reps`;
}
