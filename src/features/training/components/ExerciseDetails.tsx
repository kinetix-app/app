import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/theme/tokens';
import { trainingApi } from '../api';
import { ExerciseMedia } from './ExerciseMedia';
import { ExerciseHistory } from './ExerciseHistory';
import { ExerciseEvolution } from './ExerciseEvolution';
import type { Exercise, ExerciseSummary } from '../schemas';
import { Button, Failure, IconButton, Loading, ui } from './ui';

export function ExerciseDetails({
  accountId,
  exerciseId,
  onClose,
  onAdd,
}: Readonly<{
  accountId: number;
  exerciseId: number;
  onClose: () => void;
  onAdd?: (exercise: ExerciseSummary) => void;
}>) {
  const p = usePalette();
  const [tab, setTab] = useState<'Instructions' | 'History' | 'Evolution'>('Instructions');
  const detail = useQuery({
    queryKey: ['training', accountId, 'exercise', exerciseId],
    queryFn: ({ signal }) => trainingApi.exercise(exerciseId, signal),
  });
  return (
    <Modal onRequestClose={onClose} animationType="slide">
      <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
        <ScrollView contentContainerStyle={ui.content}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconButton icon="arrow-left" label="Back" onPress={onClose} />
            {detail.data ? (
              <Text accessibilityRole="header" style={[ui.heading, { color: p.ink, flex: 1 }]}>
                {detail.data.name}
              </Text>
            ) : null}
          </View>
          {detail.isPending ? <Loading /> : null}
          {detail.isError ? (
            <Failure
              error={detail.error}
              retry={() => {
                void detail.refetch();
              }}
            />
          ) : null}
          {detail.data ? (
            <>
              <View accessibilityRole="tablist" style={ui.row}>
                {(['Instructions', 'History', 'Evolution'] as const).map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === value }}
                    aria-selected={tab === value}
                    onPress={() => setTab(value)}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderBottomWidth: tab === value ? 2 : 0,
                      borderColor: p.brand,
                    }}
                  >
                    <Text style={{ color: p.ink }}>{value}</Text>
                  </Pressable>
                ))}
              </View>
              {tab === 'History' ? (
                <ExerciseHistory accountId={accountId} exerciseId={exerciseId} />
              ) : null}
              {tab === 'Evolution' ? (
                <ExerciseEvolution
                  accountId={accountId}
                  exerciseId={exerciseId}
                  activityType={detail.data.activity_type}
                />
              ) : null}
              {tab === 'Instructions' ? <ExerciseInstructions exercise={detail.data} /> : null}
              {onAdd ? (
                <Button
                  title="Add"
                  accessibilityLabel={`Add ${detail.data.name}`}
                  tone="positive"
                  onPress={() => {
                    if (detail.data) onAdd(detail.data);
                  }}
                />
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ExerciseInstructions({ exercise }: Readonly<{ exercise: Exercise }>) {
  const p = usePalette();
  return (
    <>
      <ExerciseMedia
        name={exercise.name}
        videoUrl={exercise.video_url}
        imageUrl={exercise.image_url}
      />
      {exercise.overview ? <Text style={{ color: p.ink }}>{exercise.overview}</Text> : null}
      <View style={ui.gap}>
        {exercise.equipments?.length ? (
          <Text style={{ color: p['ink-muted'] }}>
            Equipment: {exercise.equipments.join(' · ')}
          </Text>
        ) : null}
      </View>
      <Text style={[ui.heading, { color: p.ink }]}>Instructions</Text>
      {exercise.instructions?.length ? (
        exercise.instructions.map((text, i) => (
          <Text key={text} style={{ color: p.ink }}>
            {i + 1}. {text}
          </Text>
        ))
      ) : (
        <Text style={{ color: p['ink-muted'] }}>No instructions available.</Text>
      )}
    </>
  );
}
