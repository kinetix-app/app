import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLanguage } from '@/i18n/Language';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { Button, ui } from '@/features/training/components/ui';
import type { AnalysisView } from '../view';
import { DemoNotice } from './ResultScreen';
import { FormCheckScreen } from './FormCheckScreen';

type NotAssessable = Extract<AnalysisView, { kind: 'not_assessable' }>;

/** Explains why no assessment exists. It never marks the set as good or bad. */
export function CannotAssessScreen({
  view,
  exerciseName,
  setNumber,
  isDemo,
  hasVideo,
  onWatchVideo,
  onRecordAgain,
  onLogByHand,
}: Readonly<{
  view: NotAssessable;
  exerciseName: string;
  setNumber: number;
  isDemo: boolean;
  hasVideo: boolean;
  onWatchVideo: () => void;
  onRecordAgain: () => void;
  onLogByHand: () => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <FormCheckScreen
      overline={`${exerciseName.toUpperCase()} · ${es ? 'SERIE' : 'SET'} ${setNumber}`}
      backIcon="x"
      backLabel={es ? 'Volver al entrenamiento' : 'Back to workout'}
      onBack={onLogByHand}
      footer={
        <>
          <Button
            title={es ? 'Grabar de nuevo' : 'Record again'}
            icon="video"
            onPress={onRecordAgain}
          />
          {hasVideo ? (
            <Button
              title={es ? 'Ver grabación' : 'Watch recording'}
              icon="play"
              onPress={onWatchVideo}
              secondary
            />
          ) : null}
          <Button
            title={es ? 'Registrar serie manualmente' : 'Log set by hand'}
            onPress={onLogByHand}
            secondary
          />
        </>
      }
    >
      {isDemo ? <DemoNotice /> : null}
      <View style={ui.gap}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radii['radius-pill'],
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: p['surface-300'],
          }}
        >
          <Feather name="video-off" size={32} color={p.warning} />
        </View>
        <Text accessibilityRole="header" style={[textStyles['display-lg'], { color: p.ink }]}>
          {es ? 'No hemos podido revisar tu técnica' : "We couldn't check your form"}
        </Text>
      </View>
      {view.reasons.map((reason) => (
        <View
          key={reason.id}
          style={[ui.card, { backgroundColor: p['surface-200'], gap: spacing['space-2'] }]}
        >
          <Text style={[textStyles['title-md'], { color: p.ink }]}>{reason.title}</Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            {reason.explanation}
          </Text>
          {reason.fixes.map((fix) => (
            <View key={fix} style={[ui.row, { alignItems: 'flex-start' }]}>
              <Feather name="check" size={16} color={p['brand-ink']} style={{ marginTop: 3 }} />
              <Text style={[textStyles['body-sm'], { color: p.ink, flex: 1 }]}>{fix}</Text>
            </View>
          ))}
        </View>
      ))}
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        {es
          ? 'Tu serie no se marca como buena ni mala. Puedes registrarla manualmente.'
          : 'Your set is not marked as good or bad. You can still log it by hand.'}
      </Text>
    </FormCheckScreen>
  );
}
