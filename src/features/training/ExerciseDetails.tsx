import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/theme/tokens';
import { trainingApi } from './api';
import { ExerciseMedia } from './ExerciseMedia';
import type { ExerciseSummary } from './schemas';
import { Button, Failure, IconButton, Loading, ui } from './ui';

export function ExerciseDetails({
  accountId,
  exerciseId,
  onClose,
  onAdd,
}: {
  accountId: number;
  exerciseId: number;
  onClose: () => void;
  onAdd?: (exercise: ExerciseSummary) => void;
}) {
  const p = usePalette();
  const detail = useQuery({
    queryKey: ['training', accountId, 'exercise', exerciseId],
    queryFn: ({ signal }) => trainingApi.exercise(exerciseId, signal),
  });
  return (
    <Modal onRequestClose={onClose} animationType="slide">
      <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
        <ScrollView contentContainerStyle={ui.content}>
          <IconButton icon="arrow-left" label="Back" onPress={onClose} />
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
              <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
                {detail.data.name}
              </Text>
              <ExerciseMedia
                name={detail.data.name}
                videoUrl={detail.data.video_url}
                imageUrl={detail.data.image_url}
              />
              {detail.data.overview ? (
                <Text style={{ color: p.ink }}>{detail.data.overview}</Text>
              ) : null}
              <View style={ui.gap}>
                {detail.data.equipments?.length ? (
                  <Text style={{ color: p['ink-muted'] }}>
                    Equipment: {detail.data.equipments.join(' · ')}
                  </Text>
                ) : null}
              </View>
              <Text style={[ui.heading, { color: p.ink }]}>Instructions</Text>
              {detail.data.instructions?.length ? (
                detail.data.instructions.map((text, i) => (
                  <Text key={i} style={{ color: p.ink }}>
                    {i + 1}. {text}
                  </Text>
                ))
              ) : (
                <Text style={{ color: p['ink-muted'] }}>No instructions available.</Text>
              )}
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
