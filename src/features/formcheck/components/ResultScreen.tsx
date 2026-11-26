import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { selectCopy, useLanguage } from '@/i18n/Language';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { Button, ui } from '@/features/training/components/ui';
import type { AnalysisView } from '../view';
import { FormCheckScreen } from './FormCheckScreen';

type Assessed = Extract<AnalysisView, { kind: 'assessed' }>;

function repSummary(repCount: number, es: boolean) {
  if (es) return repCount === 1 ? 'repetición detectada' : 'repeticiones detectadas';
  return repCount === 1 ? 'rep detected' : 'reps detected';
}

function repAccessibilityLabel(index: number, ok: boolean, label: string, es: boolean) {
  if (es) return `Repetición ${index}: ${ok ? 'sin problemas' : label}`;
  return `Rep ${index}: ${ok ? 'no issues' : label}`;
}

function RepResults({
  view,
  es,
  p,
}: Readonly<{ view: Assessed; es: boolean; p: ReturnType<typeof usePalette> }>) {
  return (
    <View style={ui.gap}>
      <Text style={[textStyles.overline, { color: p['ink-muted'] }]}>
        {selectCopy(es, 'REPETICIÓN A REPETICIÓN', 'REP BY REP')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-2'] }}>
        {view.reps.map((rep) => (
          <View
            key={rep.index}
            accessibilityLabel={repAccessibilityLabel(rep.index, rep.ok, rep.label, es)}
            style={{
              minWidth: 52,
              alignItems: 'center',
              gap: spacing['space-1'],
              paddingVertical: spacing['space-2'],
              paddingHorizontal: spacing['space-2'],
              borderRadius: radii['radius-md'],
              backgroundColor: p['surface-200'],
            }}
          >
            <Text style={[textStyles.label, { color: p.ink, fontVariant: ['tabular-nums'] }]}>
              {rep.index}
            </Text>
            <Text style={[textStyles.label, { color: rep.ok ? p.success : p.warning }]}>
              {rep.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Placeholder results must never read as a real assessment. */
export function DemoNotice() {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <View
      accessibilityRole="alert"
      style={[ui.row, ui.card, { backgroundColor: p['surface-300'], alignItems: 'flex-start' }]}
    >
      <Feather name="info" size={18} color={p.info} style={{ marginTop: 2 }} />
      <Text style={[textStyles['body-sm'], { color: p.ink, flex: 1 }]}>
        {selectCopy(
          es,
          'Análisis de demostración: este resultado es provisional y aún no evalúa tu técnica.',
          'Demo analysis: this result is a placeholder, not a real check of your form yet.',
        )}
      </Text>
    </View>
  );
}

/** Things the user did well, each with a check mark. */
function PraiseList({ items }: Readonly<{ items: string[] }>) {
  const p = usePalette();
  return (
    <View style={{ gap: spacing['space-2'] }}>
      {items.map((item) => (
        <View key={item} style={[ui.row, { alignItems: 'flex-start' }]}>
          <Feather name="check" size={16} color={p.success} style={{ marginTop: 2 }} />
          <Text style={[textStyles['body-sm'], { color: p.ink, flex: 1 }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

/** Reps, findings and advice for an assessed set. Nothing here is specific to one exercise. */
export function ResultScreen({
  view,
  exerciseName,
  setNumber,
  isDemo,
  hasVideo,
  onWatchVideo,
  onRecordAgain,
  onDone,
}: Readonly<{
  view: Assessed;
  exerciseName: string;
  setNumber: number;
  isDemo: boolean;
  hasVideo: boolean;
  onWatchVideo: () => void;
  onRecordAgain: () => void;
  onDone: () => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <FormCheckScreen
      overline={`${exerciseName.toUpperCase()} · ${selectCopy(es, 'SERIE', 'SET')} ${setNumber}`}
      title={selectCopy(es, 'Serie analizada', 'Set analyzed')}
      backIcon="x"
      backLabel={selectCopy(es, 'Volver al entrenamiento', 'Back to workout')}
      onBack={onDone}
      footer={
        <>
          <Button title={selectCopy(es, 'Listo', 'Done')} onPress={onDone} />
          {hasVideo ? (
            <Button
              title={selectCopy(es, 'Ver grabación', 'Watch recording')}
              icon="play"
              onPress={onWatchVideo}
              secondary
            />
          ) : null}
          <Button
            title={selectCopy(es, 'Grabar de nuevo', 'Record again')}
            icon="video"
            onPress={onRecordAgain}
            secondary
          />
        </>
      }
    >
      {isDemo ? <DemoNotice /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing['space-2'] }}>
        <Text style={[textStyles['metric-xl'], { color: p.ink, fontVariant: ['tabular-nums'] }]}>
          {view.repCount}
        </Text>
        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
          {repSummary(view.repCount, es)}
        </Text>
      </View>
      {view.score !== null ? (
        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
          {selectCopy(es, 'Puntuación técnica', 'Technique score')}{' '}
          <Text style={{ color: p.ink, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
            {Math.round(view.score)}
          </Text>{' '}
          / 100
        </Text>
      ) : null}
      <RepResults view={view} es={es} p={p} />
      {view.issues.length ? (
        <>
          {view.praise.length ? (
            <View style={[ui.card, { backgroundColor: p['surface-200'] }]}>
              <Text style={[textStyles.overline, { color: p.success }]}>
                {selectCopy(es, 'QUÉ HA IDO BIEN', 'WHAT WENT WELL')}
              </Text>
              <PraiseList items={view.praise} />
            </View>
          ) : null}
          {view.issues.map((issue) => (
            <View key={issue.id} style={[ui.card, { backgroundColor: p['surface-200'] }]}>
              <Text style={[textStyles.overline, { color: p.warning }]}>
                {selectCopy(es, 'PROBLEMA', 'ISSUE')} · {issue.label.toUpperCase()}
              </Text>
              <Text style={[textStyles['title-md'], { color: p.ink }]}>{issue.title}</Text>
              {issue.explanation ? (
                <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                  {issue.explanation}
                </Text>
              ) : null}
            </View>
          ))}
        </>
      ) : (
        <View style={[ui.card, { backgroundColor: p['surface-200'] }]}>
          <View style={ui.row}>
            <Feather name="check-circle" size={20} color={p.success} />
            <Text style={[textStyles['title-md'], { color: p.ink }]}>{view.verdict}</Text>
          </View>
          {view.praise.length ? (
            <PraiseList items={view.praise} />
          ) : (
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              {selectCopy(
                es,
                'Todas las repeticiones se veían bien. Sigue así.',
                'Every rep looked good. Keep it up.',
              )}
            </Text>
          )}
        </View>
      )}
      {view.tip ? (
        <View style={[ui.card, { backgroundColor: p['brand-soft'], gap: spacing['space-1'] }]}>
          <Text style={[textStyles.overline, { color: p['brand-ink'] }]}>
            {selectCopy(es, 'PRÓXIMA SERIE', 'NEXT SET')}
          </Text>
          <Text style={[textStyles.body, { color: p['brand-ink'] }]}>{view.tip}</Text>
        </View>
      ) : null}
      <Text style={[textStyles.caption, { color: p['ink-muted'] }]}>
        {selectCopy(
          es,
          '¿El recuento es incorrecto? Puedes editar las repeticiones de la serie.',
          'Wrong count? You can edit the reps in the set.',
        )}
      </Text>
    </FormCheckScreen>
  );
}
