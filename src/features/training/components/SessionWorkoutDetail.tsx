import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { Modal } from 'react-native';
import { InitialAvatar } from '@/components/InitialAvatar';
import { getAccount } from '@/features/accounts/api';
import { ProfileAvatar } from '@/features/accounts/components/ProfileAvatar';
import { useLanguage } from '@/i18n/Language';
import { trainingApi } from '../api';
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
  // The authenticated shell already loads and updates the signed-in person's profile.
  const { data: account } = useQuery({
    queryKey: ['accounts', accountId, 'me'],
    queryFn: ({ signal }) => getAccount(undefined, signal),
    enabled: false,
  });
  const es = useLanguage() === 'es';
  const name = account?.profile.display_name?.trim() || (es ? 'Tú' : 'You');
  return (
    <WorkoutDetail
      workout={detail.isSuccess ? detail.data : undefined}
      author={{
        name,
        avatar: account ? (
          <ProfileAvatar account={account} size={40} compact />
        ) : (
          <InitialAvatar name={name} />
        ),
      }}
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
      activityType: slot.exercise.activity_type,
      sets: slot.sets.map((set) => ({
        ...set,
        weight_kg: set.weight?.unit === weightUnit ? set.weight.value : set.weight_kg,
      })),
    })),
  };
}
