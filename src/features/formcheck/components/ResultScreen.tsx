import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { Button, ui } from '@/features/training/components/ui';
import type { AnalysisView } from '../view';
import { FormCheckScreen } from './FormCheckScreen';

type Assessed = Extract<AnalysisView, { kind: 'assessed' }>;

/** Placeholder results must never read as a real assessment. */
export function DemoNotice() {
  const p = usePalette();
  return (
    <View
      accessibilityRole="alert"
      style={[ui.row, ui.card, { backgroundColor: p['surface-300'], alignItems: 'flex-start' }]}
    >
      <Feather name="info" size={18} color={p.info} style={{ marginTop: 2 }} />
      <Text style={[textStyles['body-sm'], { color: p.ink, flex: 1 }]}>
        Demo analysis: this result is a placeholder, not a real check of your form yet.
      </Text>
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
  return (
    <FormCheckScreen
      overline={`${exerciseName.toUpperCase()} · SET ${setNumber}`}
      title="Set analyzed"
      backIcon="x"
      backLabel="Back to workout"
      onBack={onDone}
      footer={
        <>
          <Button title="Done" onPress={onDone} />
          {hasVideo ? (
            <Button title="Watch recording" icon="play" onPress={onWatchVideo} secondary />
          ) : null}
          <Button title="Record again" icon="video" onPress={onRecordAgain} secondary />
        </>
      }
    >
      {isDemo ? <DemoNotice /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing['space-2'] }}>
        <Text style={[textStyles['metric-xl'], { color: p.ink, fontVariant: ['tabular-nums'] }]}>
          {view.repCount}
        </Text>
        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
          {view.repCount === 1 ? 'rep detected' : 'reps detected'}
        </Text>
      </View>
      <View style={ui.gap}>
        <Text style={[textStyles.overline, { color: p['ink-muted'] }]}>REP BY REP</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-2'] }}>
          {view.reps.map((rep) => (
            <View
              key={rep.index}
              accessibilityLabel={`Rep ${rep.index}: ${rep.ok ? 'no issues' : rep.label}`}
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
      {view.issues.length ? (
        view.issues.map((issue) => (
          <View key={issue.id} style={[ui.card, { backgroundColor: p['surface-200'] }]}>
            <Text style={[textStyles.overline, { color: p.warning }]}>
              ISSUE · {issue.label.toUpperCase()}
            </Text>
            <Text style={[textStyles['title-md'], { color: p.ink }]}>{issue.title}</Text>
            {issue.explanation ? (
              <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                {issue.explanation}
              </Text>
            ) : null}
          </View>
        ))
      ) : (
        <View style={[ui.card, { backgroundColor: p['surface-200'] }]}>
          <View style={ui.row}>
            <Feather name="check-circle" size={20} color={p.success} />
            <Text style={[textStyles['title-md'], { color: p.ink }]}>No issues found</Text>
          </View>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            Every rep looked fine. Keep it up.
          </Text>
        </View>
      )}
      {view.tip ? (
        <View style={[ui.card, { backgroundColor: p['brand-soft'], gap: spacing['space-1'] }]}>
          <Text style={[textStyles.overline, { color: p['brand-ink'] }]}>NEXT SET</Text>
          <Text style={[textStyles.body, { color: p['brand-ink'] }]}>{view.tip}</Text>
        </View>
      ) : null}
      <Text style={[textStyles.caption, { color: p['ink-muted'] }]}>
        Wrong count? You can edit the reps in the set.
      </Text>
    </FormCheckScreen>
  );
}
