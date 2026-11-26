import { getTranslation } from '@/i18n/catalog';
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AccessibilityInfo, Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/theme/tokens';
import { trainingApi } from '../api';
import { ExerciseMedia } from './ExerciseMedia';
import { ExerciseHistory } from './ExerciseHistory';
import { ExerciseEvolution } from './ExerciseEvolution';
import { SessionWorkoutDetail } from './SessionWorkoutDetail';
import { AnimatedTextSelector } from '@/components/AnimatedTextSelector';
import type { Exercise, ExerciseSummary } from '../schemas';
import { useLanguage } from '@/i18n/Language';
import { catalogueLabel } from '../catalogueLabels';
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
  const language = useLanguage();
  const es = language === 'es';
  const [tab, setTab] = useState<'Instructions' | 'History' | 'Evolution'>('Instructions');
  const [workoutId, setWorkoutId] = useState<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  const detail = useQuery({
    queryKey: ['training', accountId, 'exercise', exerciseId],
    queryFn: ({ signal }) => trainingApi.exercise(exerciseId, signal),
  });
  const closeWorkout = () => setWorkoutId(null);
  return (
    <Modal onRequestClose={workoutId === null ? onClose : closeWorkout} animationType="slide">
      {workoutId !== null ? (
        <SessionWorkoutDetail
          accountId={accountId}
          sessionId={workoutId}
          backLabel={getTranslation(es)('training.backToExerciseHistory_169d17')}
          onBack={closeWorkout}
        />
      ) : null}
      <SafeAreaView
        style={[
          ui.screen,
          { backgroundColor: p['surface-100'] },
          workoutId !== null && { display: 'none' },
        ]}
      >
        <ScrollView contentContainerStyle={ui.content}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconButton
              icon="arrow-left"
              label={getTranslation(es)('training.back_c16499')}
              onPress={onClose}
            />
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
                  <AnimatedTextSelector
                    key={value}
                    label={
                      es
                        ? {
                            Instructions: 'Instrucciones',
                            History: 'Historial',
                            Evolution: 'Evolución',
                          }[value]
                        : value
                    }
                    selected={tab === value}
                    role="tab"
                    reduceMotion={reduceMotion}
                    equalWidth
                    onPress={() => setTab(value)}
                  />
                ))}
              </View>
              {tab === 'History' ? (
                <ExerciseHistory
                  accountId={accountId}
                  exerciseId={exerciseId}
                  onOpenWorkout={setWorkoutId}
                />
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
                  title={getTranslation(es)('training.add_8d5f06')}
                  accessibilityLabel={getTranslation(es)('dynamicMessages.add_345e7a', {
                    value1: detail.data.name,
                  })}
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
  const language = useLanguage();
  const es = language === 'es';
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
            {getTranslation(es)('training.equipment_0cd9d5')}:{' '}
            {exercise.equipments.map((value) => catalogueLabel(value, language)).join(' · ')}
          </Text>
        ) : null}
      </View>
      <Text style={[ui.heading, { color: p.ink }]}>
        {getTranslation(es)('training.instructions_37a236')}
      </Text>
      {exercise.instructions?.length ? (
        exercise.instructions.map((text, i) => (
          <Text key={text} style={{ color: p.ink }}>
            {i + 1}. {text}
          </Text>
        ))
      ) : (
        <Text style={{ color: p['ink-muted'] }}>
          {getTranslation(es)('training.noInstructionsAvailable_bfe88c')}
        </Text>
      )}
    </>
  );
}
