import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { formatCardioDuration } from '../cardio';
import { ui } from './ui';

type RecordedSet = Readonly<{
  set_number: number;
  weight_kg: string | null;
  reps: number | null;
  distance_km: string | null;
  duration_seconds: number | null;
}>;

export type WorkoutExercise = Readonly<{
  id: string | number;
  name: string;
  imageUrl: string | null;
  activityType?: string;
  sets: readonly RecordedSet[];
}>;

export function WorkoutExerciseResults({
  exercise,
  position,
}: Readonly<{ exercise: WorkoutExercise; position: number }>) {
  const p = usePalette();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const image = exercise.imageUrl !== failedImage ? exercise.imageUrl : null;
  const { sets } = exercise;
  const liftingRecorded = sets.some(hasStrength);
  const cardioRecorded = sets.some(hasCardio);
  const cardioOnly = !liftingRecorded && (cardioRecorded || exercise.activityType === 'cardio');
  // A legacy set can contain both kinds of measures. Keep both tied to its original set number.
  const lifting = sets.filter((set) => hasStrength(set) || (!cardioOnly && !hasCardio(set)));
  const cardio = sets.filter((set) => hasCardio(set) || (cardioOnly && !hasStrength(set)));

  return (
    <View
      testID={`workout-exercise-${position}`}
      style={[ui.card, styles.exercise, { backgroundColor: p['surface-200'] }]}
    >
      <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
        {position + 1}. {exercise.name}
      </Text>
      <View style={styles.columns}>
        <View style={[styles.thumbnail, { borderColor: p.line }]}>
          {image ? (
            <Image
              source={{ uri: image }}
              accessibilityLabel={`Image of ${exercise.name}`}
              resizeMode="contain"
              style={styles.image}
              onError={() => setFailedImage(image)}
            />
          ) : (
            <Feather name="image" size={22} color={p['ink-muted']} accessible={false} />
          )}
        </View>
        <View style={styles.tables}>
          {lifting.length > 0 ? <SetTable sets={lifting} /> : null}
          {cardio.length > 0 ? <SetTable sets={cardio} cardio /> : null}
          {sets.length === 0 ? (
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>No sets recorded</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function hasStrength(set: RecordedSet) {
  return set.reps !== null || set.weight_kg !== null;
}

function hasCardio(set: RecordedSet) {
  return set.distance_km !== null || set.duration_seconds !== null;
}

function setRepetitions(set: RecordedSet, cardio: boolean): string | number {
  if (!cardio) return set.reps ?? '—';
  return set.duration_seconds === null ? '—' : formatCardioDuration(set.duration_seconds);
}

function SetTable({
  sets,
  cardio = false,
}: Readonly<{ sets: readonly RecordedSet[]; cardio?: boolean }>) {
  const p = usePalette();
  const columnTitle = [textStyles['body-sm'], { color: p['ink-muted'] }];
  const value = [textStyles.body, styles.number, { color: p.ink }];

  return (
    <View role="table" accessibilityLabel={cardio ? 'Cardio sets' : 'Strength sets'}>
      <View role="row" style={[styles.row, styles.tableHeader]}>
        <Text role="columnheader" style={[columnTitle, styles.setNumber]}>
          Set
        </Text>
        <Text role="columnheader" style={[columnTitle, styles.measurement]}>
          {cardio ? 'Distance (km)' : 'Weight (kg)'}
        </Text>
        <Text
          role="columnheader"
          accessibilityLabel={cardio ? 'Time in hours, minutes and seconds' : undefined}
          style={[columnTitle, styles.measurement]}
        >
          {cardio ? 'Time (h:m:s)' : 'Reps'}
        </Text>
      </View>
      {sets.map((set, index) => (
        <View
          key={`${set.set_number}-${index}`}
          role="row"
          style={[styles.row, styles.set, { borderColor: p.line }]}
        >
          <Text role="cell" style={[value, styles.setNumber]}>
            {set.set_number}
          </Text>
          <Text role="cell" style={[value, styles.measurement]}>
            {(cardio ? set.distance_km : set.weight_kg) ?? '—'}
          </Text>
          <Text role="cell" style={[value, styles.measurement]}>
            {setRepetitions(set, cardio)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  exercise: { padding: spacing['space-3'] },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['space-3'] },
  thumbnail: {
    width: '27%',
    maxWidth: 112,
    aspectRatio: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii['radius-md'],
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  tables: { flex: 1, minWidth: 0, gap: spacing['space-3'] },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing['space-2'] },
  tableHeader: { paddingBottom: spacing['space-1'] },
  set: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing['space-2'],
  },
  setNumber: { flexBasis: '16%' },
  measurement: { flex: 1, minWidth: 0, textAlign: 'right' },
  number: { fontVariant: ['tabular-nums'] },
});
