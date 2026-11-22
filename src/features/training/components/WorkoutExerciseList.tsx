import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { ui } from './ui';

type WorkoutExercise = Readonly<{
  id: string | number;
  name: string;
  sets: readonly Readonly<{ number: number; result: string }>[];
}>;

export function WorkoutExerciseList({
  exercises,
}: Readonly<{ exercises: readonly WorkoutExercise[] }>) {
  const p = usePalette();
  if (!exercises.length) {
    return <Text style={{ color: p['ink-muted'] }}>No exercises were recorded.</Text>;
  }

  return (
    <>
      {exercises.map((exercise, position) => (
        <WorkoutExerciseCard key={exercise.id} exercise={exercise} position={position} />
      ))}
    </>
  );
}

export function WorkoutExerciseCard({
  exercise,
  position,
}: Readonly<{ exercise: WorkoutExercise; position: number }>) {
  const p = usePalette();
  return (
    <View
      testID={`workout-exercise-${position}`}
      style={[ui.card, styles.card, { backgroundColor: p['surface-200'] }]}
    >
      <View style={styles.heading}>
        <Text
          accessibilityRole="header"
          style={[textStyles['title-md'], styles.name, { color: p.ink }]}
        >
          {exercise.name}
        </Text>
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}
        </Text>
      </View>
      {exercise.sets.map((set, index) => (
        <View key={`${set.number}-${index}`} style={[styles.set, { borderTopColor: p.line }]}>
          <Text style={[textStyles.label, { color: p['ink-muted'] }]}>Set {set.number}</Text>
          <Text style={[textStyles.body, styles.result, { color: p.ink }]}>{set.result}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 0, paddingVertical: spacing['space-2'] },
  heading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: spacing['space-2'],
    paddingVertical: spacing['space-2'],
  },
  name: { flexGrow: 1, flexShrink: 1 },
  set: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-3'],
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing['space-3'],
  },
  result: { flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
