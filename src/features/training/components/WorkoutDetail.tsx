import { getTranslation } from '@/i18n/catalog';
import React from 'react';
import { useLanguage } from '@/i18n/Language';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/services/apiClient';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { formatElapsedDuration, formatWorkoutVolume } from '../workoutFormat';
import { Button, Failure, IconButton, Loading, ui } from './ui';
import { WorkoutExerciseResults, type WorkoutExercise } from './WorkoutExerciseResults';

export type WorkoutDetailData = Readonly<{
  title: string;
  startedAt: string;
  endedAt: string;
  volumeKg?: string;
  reps?: number;
  exercises: readonly WorkoutExercise[];
}>;

type WorkoutAuthor = Readonly<{ name: string; avatar: React.ReactNode }>;

type WorkoutDetailProps = Readonly<{
  workout?: WorkoutDetailData;
  author: WorkoutAuthor;
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
  const es = useLanguage() === 'es';
  const unavailable = error instanceof ApiError && error.status === 404;

  return (
    <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
      <View style={[styles.header, { borderBottomColor: p.line }]}>
        <View style={[styles.frame, ui.row, styles.headerContent]}>
          <IconButton icon="arrow-left" label={backLabel} onPress={onBack} />
          <Text accessibilityRole="header" style={[ui.heading, styles.fill, { color: p.ink }]}>
            {getTranslation(es ? 'es' : 'en')('training.workoutDetail_716d83')}
          </Text>
        </View>
      </View>
      <FlatList
        data={workout?.exercises ?? []}
        keyExtractor={(slot) => String(slot.id)}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={ExerciseSeparator}
        ListHeaderComponent={
          (workout ? (
            <View style={styles.summarySection}>
              <WorkoutSummary workout={workout} author={author} />
              <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
                {getTranslation(es ? 'es' : 'en')('training.exerciseResults_5824c0')}
              </Text>
            </View>
          ) : null) ?? undefined
        }
        ListEmptyComponent={
          workout ? (
            <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
              {getTranslation(es ? 'es' : 'en')('training.noExercisesWereRecorded_539dc3')}
            </Text>
          ) : (
            <View style={ui.gap}>
              {!error ? <Loading /> : null}
              {unavailable ? (
                <Text accessibilityRole="alert" style={[textStyles.body, { color: p.danger }]}>
                  {getTranslation(es ? 'es' : 'en')(
                    'training.thisWorkoutIsNoLongerAvailable_ac92e6',
                  )}
                </Text>
              ) : null}
              {error && !unavailable ? <Failure error={error} retry={onRetry} /> : null}
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <WorkoutExerciseResults position={index} exercise={item} />
        )}
      />
      {workout && showShare && onShare ? (
        <View
          style={[styles.footer, { backgroundColor: p['surface-100'], borderTopColor: p.line }]}
        >
          <View style={[styles.frame, styles.footerContent]}>
            <Button
              title={getTranslation(es ? 'es' : 'en')('training.shareToFeed_97c2f4')}
              icon="share"
              onPress={onShare}
            />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function WorkoutSummary({
  workout,
  author,
}: Readonly<{ workout: WorkoutDetailData; author: WorkoutAuthor }>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const completed = new Date(workout.endedAt);
  const elapsedSeconds = Math.max(
    0,
    Math.floor((completed.getTime() - Date.parse(workout.startedAt)) / 1000),
  );
  const completionDate = completed.toLocaleDateString(es ? 'es' : undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const completionTime = completed.toLocaleTimeString(es ? 'es' : undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const sets = workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

  return (
    <View style={[ui.card, styles.summary, { backgroundColor: p['surface-200'] }]}>
      <View style={styles.identity}>
        <Text accessibilityRole="header" style={[textStyles['title-lg'], { color: p.ink }]}>
          {workout.title}
        </Text>
        <View testID="workout-detail-author" style={ui.row}>
          <View
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {author.avatar}
          </View>
          <View style={styles.fill}>
            <Text style={[textStyles.label, { color: p.ink }]}>{author.name}</Text>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              {completionDate} · {completionTime}
            </Text>
          </View>
        </View>
      </View>
      <View style={[styles.metrics, { borderColor: p.line }]}>
        <MetricRow
          testID="workout-detail-primary-metrics"
          metrics={[
            {
              label: getTranslation(es ? 'es' : 'en')('training.duration_c00c5f'),
              value: formatElapsedDuration(elapsedSeconds),
            },
            {
              label: getTranslation(es ? 'es' : 'en')('training.volume_bbc801'),
              value: formatWorkoutVolume(workout.volumeKg),
            },
            {
              label: getTranslation(es ? 'es' : 'en')('training.exercises_3f75d2'),
              value: workout.exercises.length.toLocaleString(es ? 'es' : undefined),
            },
          ]}
        />
        <MetricRow
          testID="workout-detail-secondary-metrics"
          divided
          metrics={[
            {
              label: getTranslation(es ? 'es' : 'en')('training.sets_3ae183'),
              value: sets.toLocaleString(),
            },
            {
              label: getTranslation(es ? 'es' : 'en')('training.reps_523160'),
              value: workout.reps?.toLocaleString() ?? '—',
            },
          ]}
        />
      </View>
    </View>
  );
}

function MetricRow({
  testID,
  metrics,
  divided = false,
}: Readonly<{
  testID: string;
  metrics: readonly { label: string; value: string }[];
  divided?: boolean;
}>) {
  const p = usePalette();
  return (
    <View
      testID={testID}
      style={[styles.metricRow, divided && [styles.secondaryMetricRow, { borderColor: p.line }]]}
    >
      {metrics.map(({ label, value }, index) => (
        <View
          key={label}
          style={[styles.metric, index > 0 && styles.metricDivider, { borderColor: p.line }]}
        >
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
  summarySection: { gap: spacing['space-5'], marginBottom: spacing['space-4'] },
  summary: { gap: spacing['space-4'] },
  identity: { gap: spacing['space-3'] },
  metrics: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metricRow: { flexDirection: 'row', paddingVertical: spacing['space-3'] },
  secondaryMetricRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 0 },
  metric: {
    flex: 1,
    minWidth: 0,
    gap: spacing['space-1'],
    paddingRight: spacing['space-2'],
  },
  metricDivider: { borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: spacing['space-3'] },
  tabular: { fontVariant: ['tabular-nums'] },
  separator: { height: spacing['space-3'] },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
  footerContent: {
    paddingHorizontal: spacing['space-4'],
    paddingVertical: spacing['space-3'],
  },
});
