import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { ui } from './ui';

export type WorkoutExercise = Readonly<{
  id: string | number;
  name: string;
  imageUrl: string | null;
  sets: readonly Readonly<{ number: number; result: string }>[];
}>;

export function WorkoutExerciseCard({
  exercise,
  position,
}: Readonly<{ exercise: WorkoutExercise; position: number }>) {
  const p = usePalette();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const image = exercise.imageUrl !== failedImage ? exercise.imageUrl : null;
  return (
    <View
      testID={`workout-exercise-${position}`}
      style={[ui.card, { backgroundColor: p['surface-200'] }]}
    >
      <View style={styles.heading}>
        <Text
          accessibilityRole="header"
          style={[textStyles['title-md'], styles.name, { color: p.ink }]}
        >
          {position + 1}. {exercise.name}
        </Text>
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}
        </Text>
      </View>
      <View style={styles.columns}>
        <View style={[styles.thumbnail, { backgroundColor: p['surface-300'] }]}>
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
        <View style={styles.results}>
          {exercise.sets.length ? (
            exercise.sets.map((set, index) => (
              <View
                key={`${set.number}-${index}`}
                style={[
                  styles.set,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.line },
                ]}
              >
                <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                  Set {set.number}
                </Text>
                <Text style={[textStyles.body, styles.result, { color: p.ink }]}>{set.result}</Text>
              </View>
            ))
          ) : (
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>No sets recorded</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: spacing['space-2'],
  },
  name: { flexGrow: 1, flexShrink: 1 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['space-3'] },
  thumbnail: {
    width: '30%',
    maxWidth: 128,
    aspectRatio: 1,
    borderRadius: radii['radius-md'],
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  results: { flex: 1, minWidth: 0 },
  set: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-2'],
    paddingVertical: spacing['space-2'],
  },
  result: { flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
