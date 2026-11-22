import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { FlatList, Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/services/apiClient';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { trainingApi } from '../api';
import { formatCardioDuration } from '../cardio';
import type { CompletedSession } from '../schemas';
import { Button, Failure, IconButton, Loading, ui } from './ui';
import { WorkoutExerciseCard } from './WorkoutExerciseList';

type WorkoutPreviewProps = Readonly<{
  accountId: number;
  sessionId: number;
  onBack: () => void;
  backLabel: string;
  showShare?: boolean;
  onShare?: (sessionId: number) => void;
}>;

const weightUnit = 'kg';

export function WorkoutPreview({
  accountId,
  sessionId,
  onBack,
  backLabel,
  showShare = false,
  onShare,
}: WorkoutPreviewProps) {
  const p = usePalette();
  const detail = useQuery({
    queryKey: ['training', accountId, 'session', sessionId, weightUnit],
    queryFn: ({ signal }) => trainingApi.session(sessionId, weightUnit, signal),
  });
  const session = detail.isError ? undefined : detail.data;
  const unavailable = detail.error instanceof ApiError && detail.error.status === 404;

  return (
    <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
      <View style={[styles.header, { borderBottomColor: p.line }]}>
        <View style={[styles.frame, ui.row, styles.headerContent]}>
          <IconButton icon="arrow-left" label={backLabel} onPress={onBack} />
          <Text accessibilityRole="header" style={[ui.heading, styles.fill, { color: p.ink }]}>
            Workout preview
          </Text>
        </View>
      </View>
      <FlatList
        data={session?.exercises ?? []}
        keyExtractor={(slot) => String(slot.id)}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={ExerciseSeparator}
        ListHeaderComponent={
          session ? (
            <View style={styles.summarySection}>
              <WorkoutSummary session={session} />
              <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
                Exercise results
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          session ? (
            <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
              No exercises were recorded.
            </Text>
          ) : (
            <View style={[ui.card, { backgroundColor: p['surface-200'] }]}>
              {detail.isPending ? <Loading /> : null}
              {unavailable ? (
                <Text accessibilityRole="alert" style={[textStyles.body, { color: p.danger }]}>
                  This workout is no longer available.
                </Text>
              ) : null}
              {detail.isError && !unavailable ? (
                <Failure error={detail.error} retry={() => void detail.refetch()} />
              ) : null}
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <WorkoutExerciseCard
            position={index}
            exercise={{
              id: item.id,
              name: `${item.exercise_order}. ${item.exercise.name}`,
              sets: item.sets.map((set) => ({
                number: set.set_number,
                result: formatWorkoutSet(set),
              })),
            }}
          />
        )}
      />
      {session && showShare && onShare ? (
        <View
          style={[styles.footer, { backgroundColor: p['surface-100'], borderTopColor: p.line }]}
        >
          <View style={[styles.frame, styles.footerContent]}>
            <Button title="Share to feed" icon="share" onPress={() => onShare(session.id)} />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

export function WorkoutPreviewModal(props: WorkoutPreviewProps) {
  return (
    <Modal animationType="slide" onRequestClose={props.onBack}>
      <WorkoutPreview {...props} />
    </Modal>
  );
}

function WorkoutSummary({ session }: Readonly<{ session: CompletedSession }>) {
  const p = usePalette();
  const started = new Date(session.started_at);
  const completed = new Date(session.ended_at);
  const elapsedSeconds = Math.max(0, Math.floor((completed.getTime() - started.getTime()) / 1000));
  const sameDay = started.toDateString() === completed.toDateString();
  const time = { hour: 'numeric', minute: '2-digit' } as const;
  const startedAt = sameDay
    ? started.toLocaleTimeString(undefined, time)
    : started.toLocaleString();
  const completedAt = completed.toLocaleTimeString(undefined, time);
  const sets = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  const metrics = [
    { label: 'Duration', value: formatElapsedDuration(elapsedSeconds) },
    { label: 'Exercises', value: session.exercises.length.toLocaleString() },
    { label: 'Sets', value: sets.toLocaleString() },
  ];

  return (
    <View style={[ui.card, styles.summary, { backgroundColor: p['surface-200'] }]}>
      <View style={styles.summaryTitle}>
        <View style={[styles.summaryIcon, { backgroundColor: p['brand-soft'] }]}>
          <Feather name="calendar" size={20} color={p['brand-ink']} />
        </View>
        <View style={[styles.fill, styles.date]}>
          <Text style={[textStyles['title-md'], { color: p.ink }]}>
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
        {metrics.map(({ label, value }) => (
          <View key={label} style={[styles.metric, { backgroundColor: p['surface-300'] }]}>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{label}</Text>
            <Text style={[textStyles['title-md'], styles.tabular, { color: p.ink }]}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ExerciseSeparator() {
  return <View style={styles.separator} />;
}

function formatElapsedDuration(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours} h`;
}

function formatWorkoutSet(set: CompletedSession['exercises'][number]['sets'][number]) {
  if (set.duration_seconds !== null || set.distance_km !== null) {
    const duration =
      set.duration_seconds === null ? '—' : formatCardioDuration(set.duration_seconds);
    return `${set.distance_km ?? '—'} km · ${duration}`;
  }
  return `${set.weight?.value ?? '—'} ${set.weight?.unit ?? weightUnit} · ${set.reps ?? '—'} reps`;
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
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-2'] },
  metric: {
    flexBasis: '26%',
    flexGrow: 1,
    minWidth: 78,
    gap: spacing['space-1'],
    padding: spacing['space-2'],
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
