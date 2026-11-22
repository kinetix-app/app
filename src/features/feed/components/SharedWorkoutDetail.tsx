import { useQuery } from '@tanstack/react-query';
import React from 'react';
import {
  WorkoutDetail,
  type WorkoutDetailData,
} from '@/features/training/components/WorkoutDetail';
import { feedApi } from '../api';
import { authorName, setLine } from '../format';
import type { Post, WorkoutDetail as PostWorkout } from '../schemas';

export function SharedWorkoutDetail({
  accountId,
  post,
  onBack,
}: Readonly<{ accountId: number; post: Post; onBack: () => void }>) {
  const detail = useQuery({
    queryKey: ['feed', accountId, 'workout', post.id],
    queryFn: ({ signal }) => feedApi.workout(post.id, signal),
    select: sharedDetail,
  });
  return (
    <WorkoutDetail
      workout={detail.isSuccess ? detail.data : undefined}
      author={authorName(post.author.display_name)}
      error={detail.error}
      onRetry={() => void detail.refetch()}
      onBack={onBack}
      backLabel="Back to feed"
    />
  );
}

function sharedDetail(workout: PostWorkout): WorkoutDetailData {
  return {
    title: workout.title,
    startedAt: workout.started_at,
    endedAt: workout.ended_at,
    volumeKg: workout.total_volume_kg,
    reps: workout.total_reps,
    exercises: workout.detailed_exercises.map((exercise, position) => ({
      id: `${exercise.exercise_id}-${position}`,
      name: exercise.name,
      imageUrl: exercise.image_url ?? null,
      sets: exercise.sets.map((set) => ({ number: set.set_number, result: setLine(set) })),
    })),
  };
}
