import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, IconButton, Loading, ui } from '@/features/training/components/ui';
import { WorkoutExerciseList } from '@/features/training/components/WorkoutExerciseList';
import { ApiError } from '@/services/apiClient';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { feedApi } from '../api';
import { authorName, duration, setLine, volume } from '../format';
import type { Post } from '../schemas';

/** Everything recorded in a shared workout: each exercise with its sets, in order. */
export function WorkoutDetailScreen({
  accountId,
  post,
  onBack,
}: Readonly<{ accountId: number; post: Post; onBack: () => void }>) {
  const p = usePalette();
  const detail = useQuery({
    queryKey: ['feed', accountId, 'workout', post.id],
    queryFn: ({ signal }) => feedApi.workout(post.id, signal),
  });
  const name = authorName(post.author.display_name);
  const workout = detail.data;
  const metrics = workout
    ? ([
        ['Duration', duration(workout.duration_seconds)],
        ['Volume', volume(workout.total_volume_kg)],
        ['Sets', String(workout.set_count)],
        ['Reps', String(workout.total_reps)],
      ] as const)
    : [];
  const date = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(workout?.started_at ?? post.workout?.started_at ?? post.created_at));

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[ui.screen, { backgroundColor: p['surface-100'] }]}
    >
      <ScrollView contentContainerStyle={ui.content}>
        <View style={ui.gap}>
          <View style={ui.row}>
            <IconButton icon="arrow-left" label="Back to feed" onPress={onBack} />
            <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
              Workout
            </Text>
          </View>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            {name} · {date}
          </Text>
          {detail.isPending ? <Loading /> : null}
          {detail.isError ? (
            <View style={ui.gap}>
              <Text accessibilityRole="alert" style={{ color: p.danger }}>
                {detail.error instanceof ApiError && detail.error.status === 404
                  ? 'This workout is no longer available.'
                  : 'Could not load the workout. Check your connection and try again.'}
              </Text>
              <Button title="Retry" secondary onPress={() => void detail.refetch()} />
            </View>
          ) : null}
          {workout ? (
            <>
              <View style={[styles.metrics, { backgroundColor: p['surface-200'] }]}>
                {metrics.map(([label, value]) => (
                  <View key={label} style={styles.metric}>
                    <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{label}</Text>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[textStyles['metric-md'], styles.tabular, { color: p.ink }]}
                    >
                      {value}
                    </Text>
                  </View>
                ))}
              </View>
              <WorkoutExerciseList
                exercises={workout.detailed_exercises.map((exercise, position) => ({
                  id: `${exercise.exercise_id}-${position}`,
                  name: exercise.name,
                  sets: exercise.sets.map((set) => ({
                    number: set.set_number,
                    result: setLine(set),
                  })),
                }))}
              />
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: radii['radius-md'],
    padding: spacing['space-3'],
    gap: spacing['space-3'],
  },
  metric: { flexGrow: 1, flexBasis: '20%', minWidth: 64 },
  tabular: { fontVariant: ['tabular-nums'] },
});
