import { Feather } from '@expo/vector-icons';
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/services/apiClient';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { formatElapsedDuration, formatWorkoutVolume } from '../workoutFormat';
import { Button, Failure, IconButton, Loading, ui } from './ui';
import { WorkoutExerciseCard, type WorkoutExercise } from './WorkoutExerciseCard';

export type WorkoutDetailData = Readonly<{
  title: string;
  startedAt: string;
  endedAt: string;
  volumeKg?: string;
  reps?: number;
  exercises: readonly WorkoutExercise[];
}>;

type WorkoutDetailProps = Readonly<{
  workout?: WorkoutDetailData;
  author?: string;
  error: Error | null;
  onRetry: () => void;
  onBack: () => void;
  backLabel: string;
  showShare?: boolean;
  onShare?: () => void;
}>;

export function WorkoutDetail({
  workout,
  author,
  error,
  onRetry,
  onBack,
  backLabel,
  showShare = false,
  onShare,
}: WorkoutDetailProps) {
  const p = usePalette();
  const unavailable = error instanceof ApiError && error.status === 404;

  return (
    <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
      <View style={[styles.header, { borderBottomColor: p.line }]}>
        <View style={[styles.frame, ui.row, styles.headerContent]}>
          <IconButton icon="arrow-left" label={backLabel} onPress={onBack} />
          <Text accessibilityRole="header" style={[ui.heading, styles.fill, { color: p.ink }]}>
            Workout detail
          </Text>
        </View>
      </View>
      <FlatList
        data={workout?.exercises ?? []}
        keyExtractor={(slot) => String(slot.id)}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={ExerciseSeparator}
        ListHeaderComponent={
          workout ? (
            <View style={styles.summarySection}>
              <WorkoutSummary workout={workout} author={author} />
              <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
                Exercise results
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          workout ? (
            <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
              No exercises were recorded.
            </Text>
          ) : (
            <View style={[ui.card, { backgroundColor: p['surface-200'] }]}>
              {!error ? <Loading /> : null}
              {unavailable ? (
                <Text accessibilityRole="alert" style={[textStyles.body, { color: p.danger }]}>
                  This workout is no longer available.
                </Text>
              ) : null}
              {error && !unavailable ? <Failure error={error} retry={onRetry} /> : null}
            </View>
          )
        }
        renderItem={({ item, index }) => <WorkoutExerciseCard position={index} exercise={item} />}
      />
      {workout && showShare && onShare ? (
        <View
          style={[styles.footer, { backgroundColor: p['surface-100'], borderTopColor: p.line }]}
        >
          <View style={[styles.frame, styles.footerContent]}>
            <Button title="Share to feed" icon="share" onPress={onShare} />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function WorkoutSummary({
  workout,
  author,
}: Readonly<{ workout: WorkoutDetailData; author?: string }>) {
  const p = usePalette();
  const started = new Date(workout.startedAt);
  const completed = new Date(workout.endedAt);
  const elapsedSeconds = Math.max(0, Math.floor((completed.getTime() - started.getTime()) / 1000));
  const sameDay = started.toDateString() === completed.toDateString();
  const time = { hour: 'numeric', minute: '2-digit' } as const;
  const startedAt = sameDay
    ? started.toLocaleTimeString(undefined, time)
    : started.toLocaleString();
  const completedAt = completed.toLocaleTimeString(undefined, time);
  const sets = workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

  return (
    <View style={[ui.card, styles.summary, { backgroundColor: p['surface-200'] }]}>
      <View style={styles.summaryTitle}>
        <View style={[styles.summaryIcon, { backgroundColor: p['brand-soft'] }]}>
          <Feather name="calendar" size={20} color={p['brand-ink']} />
        </View>
        <View style={[styles.fill, styles.date]}>
          <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
            {workout.title}
          </Text>
          {author ? (
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{author}</Text>
          ) : null}
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            {completed.toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            {startedAt} – {completedAt}
          </Text>
        </View>
      </View>
      <View style={styles.metrics}>
        <MetricRow
          testID="workout-detail-primary-metrics"
          metrics={[
            { label: 'Duration', value: formatElapsedDuration(elapsedSeconds) },
            { label: 'Exercises', value: workout.exercises.length.toLocaleString() },
            { label: 'Volume', value: formatWorkoutVolume(workout.volumeKg) },
          ]}
        />
        <MetricRow
          testID="workout-detail-secondary-metrics"
          metrics={[
            { label: 'Sets', value: sets.toLocaleString() },
            { label: 'Reps', value: workout.reps?.toLocaleString() ?? '—' },
          ]}
        />
      </View>
    </View>
  );
}

function MetricRow({
  testID,
  metrics,
}: Readonly<{ testID: string; metrics: readonly { label: string; value: string }[] }>) {
  const p = usePalette();
  return (
    <View testID={testID} style={styles.metricRow}>
      {metrics.map(({ label, value }) => (
        <View key={label} style={[styles.metric, { backgroundColor: p['surface-300'] }]}>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{label}</Text>
          <Text style={[textStyles['title-md'], styles.tabular, { color: p.ink }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function ExerciseSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  frame: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  fill: { flex: 1, minWidth: 0 },
  header: { borderBottomWidth: StyleSheet.hairlineWidth },
  headerContent: {
    paddingHorizontal: spacing['space-4'],
    paddingVertical: spacing['space-3'],
  },
  list: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    padding: spacing['space-4'],
    paddingBottom: spacing['space-8'],
  },
  summarySection: { gap: spacing['space-5'], marginBottom: spacing['space-3'] },
  summary: { gap: spacing['space-4'] },
  summaryTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-3'] },
  summaryIcon: {
    padding: spacing['space-3'],
    borderRadius: radii['radius-md'],
  },
  date: { gap: spacing['space-1'] },
  metrics: { gap: spacing['space-2'] },
  metricRow: { flexDirection: 'row', gap: spacing['space-2'] },
  metric: {
    flex: 1,
    minWidth: 0,
    gap: spacing['space-1'],
    paddingVertical: spacing['space-2'],
    paddingHorizontal: spacing['space-1'],
    borderRadius: radii['radius-md'],
  },
  tabular: { fontVariant: ['tabular-nums'] },
  separator: { height: spacing['space-3'] },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
  footerContent: {
    paddingHorizontal: spacing['space-4'],
    paddingVertical: spacing['space-3'],
  },
});
