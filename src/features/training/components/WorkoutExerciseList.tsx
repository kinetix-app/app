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
        <View
          key={exercise.id}
          testID={`workout-exercise-${position}`}
          style={[ui.card, { backgroundColor: p['surface-200'] }]}
        >
          <Text style={[textStyles['title-md'], { color: p.ink }]}>{exercise.name}</Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            {exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}
          </Text>
          {exercise.sets.map((set, index) => (
            <View key={`${set.number}-${index}`} style={[styles.set, { borderTopColor: p.line }]}>
              <Text style={[textStyles.label, styles.setNumber, { color: p['ink-muted'] }]}>
                Set {set.number}
              </Text>
              <Text style={[textStyles.body, styles.result, { color: p.ink }]}>{set.result}</Text>
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  set: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-3'],
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing['space-2'],
  },
  setNumber: { minWidth: 52 },
  result: { flex: 1, fontVariant: ['tabular-nums'] },
});
