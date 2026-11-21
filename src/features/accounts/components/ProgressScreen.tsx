import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedTextSelector } from '@/components/AnimatedTextSelector';
import { Button } from '@/components/Button';
import { EvolutionGraph } from '@/components/EvolutionGraph';
import { ScreenHeader, screenContentStyle } from '@/components/ScreenHeader';
import { Toast } from '@/components/Toast';
import { palette, PaletteProvider, radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import type { MeasurementSystem } from '../profileForm';
import { measurementKey, progressApi, targetKey } from '../progressApi';
import {
  displayProgressDate,
  measurementAxis,
  measurementSeries,
  shownMeasurement,
} from '../progressForm';
import {
  measurementDefinitions,
  measurementMetrics,
  type BodyMeasurement,
  type MeasurementMetric,
  type PhysicalTarget,
} from '../progressSchemas';
import type { Account, Objective } from '../schemas';
import { objectiveOptions } from './ObjectiveEditor';
import { ProfileBack } from './ProfileBack';
import { MeasurementEditor, PhysicalTargetEditor } from './ProgressEditors';

const noMeasurements: readonly BodyMeasurement[] = [];
const progressPalettes = { light: palette('light'), dark: palette('dark') };
type Editor =
  | { kind: 'measurement' }
  | { kind: 'target'; objective: Objective; target: PhysicalTarget['target'] };

type ProgressScreenProps = Readonly<{ account: Account; onClose: () => void; active?: boolean }>;

export function ProgressScreen({ active = true, ...props }: ProgressScreenProps) {
  const appearance = useColorScheme() === 'light' ? 'light' : 'dark';
  return (
    <PaletteProvider value={progressPalettes[appearance]}>
      {active ? <StatusBar style={appearance === 'light' ? 'dark' : 'light'} /> : null}
      <ProgressContent {...props} />
    </PaletteProvider>
  );
}

function ProgressContent({ account, onClose }: ProgressScreenProps) {
  const p = usePalette();
  const cache = useQueryClient();
  const system = account.profile.measurement_system ?? 'metric';
  const accountId = account.id;
  const [metric, setMetric] = useState<MeasurementMetric>('weight_kg');
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [toast, setToast] = useState('');
  const dismissToast = useCallback(() => setToast(''), []);
  const measurements = useQuery({
    queryKey: measurementKey(accountId),
    queryFn: ({ signal }) => progressApi.measurements(signal),
  });
  const target = useQuery({
    queryKey: targetKey(accountId),
    queryFn: ({ signal }) => progressApi.target(signal),
  });
  const items = measurements.data?.items ?? noMeasurements;
  const points = useMemo(() => measurementSeries(items, metric, system), [items, metric, system]);
  const highlighted = points.find((point) => point.date === selected) ?? points.at(-1);
  const label = measurementDefinitions[metric].label;

  function measurementSaved(measurement: BodyMeasurement) {
    const measured = measurementMetrics.find((key) => measurement[key] !== null);
    if (measured && measurement[metric] === null) setMetric(measured);
    setSelected(null);
    setEditor(null);
    setToast('Measurements saved.');
    const queryKey = measurementKey(accountId);
    void cache.cancelQueries({ queryKey, exact: true });
    cache.setQueryData<typeof measurements.data>(
      queryKey,
      (previous) =>
        previous && {
          items: [...previous.items.filter((item) => item.id !== measurement.id), measurement].sort(
            (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
          ),
        },
    );
    void cache.invalidateQueries({ queryKey });
    void cache.invalidateQueries({ queryKey: ['accounts', accountId, 'me'], exact: true });
  }

  function targetSaved(result: PhysicalTarget) {
    const queryKey = targetKey(accountId);
    void cache.cancelQueries({ queryKey, exact: true });
    cache.setQueryData(queryKey, result);
    setEditor(null);
    setToast('Weight target saved.');
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={[styles.screen, { backgroundColor: p['surface-100'] }]}
    >
      <View
        style={styles.screen}
        importantForAccessibility={editor ? 'no-hide-descendants' : 'auto'}
        aria-hidden={Boolean(editor)}
      >
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <MeasurementHistoryRow item={item} system={system} />}
          ItemSeparatorComponent={HistorySeparator}
          contentContainerStyle={[screenContentStyle, styles.content]}
          ListHeaderComponent={
            <View style={styles.sections}>
              <ScreenHeader title="Progress" leading={<ProfileBack onPress={onClose} />} />
              <Button
                title="Log measurements"
                tone="positive"
                shape="rounded"
                icon="plus"
                disabled={measurements.isPending}
                onPress={() => {
                  dismissToast();
                  setEditor({ kind: 'measurement' });
                }}
              />
              <View style={[styles.card, { backgroundColor: p['surface-200'] }]}>
                <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
                  Measurement trends
                </Text>
                <ScrollView
                  horizontal
                  accessibilityRole="tablist"
                  accessibilityLabel="Measurement metric"
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.selectors}
                >
                  {measurementMetrics.map((key) => (
                    <AnimatedTextSelector
                      key={key}
                      label={measurementDefinitions[key].label}
                      selected={key === metric}
                      role="tab"
                      reduceMotion
                      onPress={() => {
                        setMetric(key);
                        setSelected(null);
                      }}
                    />
                  ))}
                </ScrollView>
                {measurements.isPending ? (
                  <ActivityIndicator accessibilityLabel="Loading measurements" color={p.brand} />
                ) : null}
                {measurements.isError ? (
                  <LoadProblem
                    message="Could not load measurements."
                    onRetry={() => void measurements.refetch()}
                  />
                ) : null}
                {measurements.data ? (
                  <>
                    <MeasurementHeadline
                      highlighted={highlighted}
                      label={label}
                      failed={measurements.isError}
                    />
                    <EvolutionGraph
                      testID="body-measurement-chart"
                      points={points}
                      selected={selected}
                      onSelect={setSelected}
                      formatAxis={(value, showUnit) =>
                        measurementAxis(value, metric, system, showUnit)
                      }
                    />
                  </>
                ) : null}
              </View>
              <View style={[styles.card, { backgroundColor: p['surface-200'] }]}>
                <View style={styles.headingRow}>
                  <View style={[styles.icon, { backgroundColor: p['brand-soft'] }]}>
                    <Feather name="target" size={18} color={p['brand-ink']} />
                  </View>
                  <Text
                    accessibilityRole="header"
                    style={[textStyles['title-md'], { color: p.ink }]}
                  >
                    Weight target
                  </Text>
                </View>
                {target.isPending ? (
                  <ActivityIndicator accessibilityLabel="Loading weight target" color={p.brand} />
                ) : null}
                {target.isError ? (
                  <LoadProblem
                    message="Could not load your weight target."
                    onRetry={() => void target.refetch()}
                  />
                ) : null}
                {target.data ? (
                  <TargetCardContent
                    system={system}
                    data={target.data}
                    onEdit={(objective, current) => {
                      dismissToast();
                      setEditor({ kind: 'target', objective, target: current });
                    }}
                  />
                ) : null}
              </View>
              <View style={styles.historyHead}>
                <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
                  Measurement history
                </Text>
                {measurements.isSuccess && items.length === 0 ? (
                  <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                    Saved check-ins will appear here.
                  </Text>
                ) : null}
              </View>
            </View>
          }
        />
      </View>
      {toast ? <Toast message={toast} onDismiss={dismissToast} /> : null}
      {editor?.kind === 'measurement' ? (
        <MeasurementEditor
          system={system}
          timeZone={account.profile.timezone}
          history={items}
          onClose={() => setEditor(null)}
          onSaved={measurementSaved}
        />
      ) : null}
      {editor?.kind === 'target' ? (
        <PhysicalTargetEditor
          system={system}
          objective={editor.objective}
          target={editor.target}
          timeZone={account.profile.timezone}
          onClose={() => setEditor(null)}
          onSaved={targetSaved}
          onObjectiveChanged={() => void target.refetch()}
        />
      ) : null}
    </SafeAreaView>
  );
}

function MeasurementHeadline({
  highlighted,
  label,
  failed,
}: Readonly<{
  highlighted: ReturnType<typeof measurementSeries>[number] | undefined;
  label: string;
  failed: boolean;
}>) {
  const p = usePalette();
  if (highlighted) {
    return (
      <View style={styles.metric}>
        <Text style={[textStyles['metric-lg'], styles.numbers, { color: p.ink }]}>
          {highlighted.label}
        </Text>
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {displayProgressDate(highlighted.date)}
        </Text>
      </View>
    );
  }
  if (failed) return null;
  return (
    <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
      No {label.toLowerCase()} measurements yet.
    </Text>
  );
}

function LoadProblem({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  const p = usePalette();
  return (
    <View style={styles.metric}>
      <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
        {message}
      </Text>
      <Button
        title="Retry"
        shape="rounded"
        accessibilityLabel={`Retry. ${message}`}
        onPress={onRetry}
        secondary
      />
    </View>
  );
}

function TargetCardContent({
  data,
  system,
  onEdit,
}: Readonly<{
  data: PhysicalTarget;
  system: MeasurementSystem;
  onEdit: (objective: Objective, target: PhysicalTarget['target']) => void;
}>) {
  const p = usePalette();
  const { objective, target } = data;
  if (!objective) {
    return (
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        Choose an objective in Profile to set a weight target.
      </Text>
    );
  }
  return (
    <View style={styles.targetRow}>
      <View style={styles.targetDetails}>
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {objectiveOptions.find((option) => option.value === objective)?.label}
        </Text>
        {target ? (
          <>
            <Text style={[textStyles['metric-md'], styles.numbers, { color: p.ink }]}>
              {shownMeasurement('weight_kg', target.weight_kg, system)}
            </Text>
            {target.target_date ? (
              <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                Target date · {displayProgressDate(target.target_date)}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={[textStyles.body, { color: p.ink }]}>No weight target set.</Text>
        )}
      </View>
      <Button
        title={target ? 'Edit target' : 'Set target'}
        shape="rounded"
        secondary
        onPress={() => onEdit(objective, target)}
      />
    </View>
  );
}

function MeasurementHistoryRow({
  item,
  system,
}: Readonly<{ item: BodyMeasurement; system: MeasurementSystem }>) {
  const p = usePalette();
  return (
    <View style={[styles.historyCard, { backgroundColor: p['surface-200'] }]}>
      <Text style={[textStyles.label, { color: p.ink }]}>{displayProgressDate(item.date)}</Text>
      <View style={styles.historyMetrics}>
        {measurementMetrics.map((metric) => {
          const raw = item[metric];
          if (raw === null) return null;
          return (
            <Text
              key={metric}
              style={[textStyles['body-sm'], styles.numbers, { color: p['ink-muted'] }]}
            >
              {measurementDefinitions[metric].label}{' '}
              <Text style={[textStyles.label, { color: p.ink }]}>
                {shownMeasurement(metric, raw, system)}
              </Text>
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function HistorySeparator() {
  return <View style={styles.historySeparator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: spacing['space-8'] },
  sections: { gap: spacing['space-4'] },
  card: { borderRadius: radii['radius-lg'], padding: spacing['space-4'], gap: spacing['space-3'] },
  selectors: { gap: spacing['space-4'] },
  metric: { gap: spacing['space-1'] },
  numbers: { fontVariant: ['tabular-nums'] },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-2'] },
  icon: { padding: spacing['space-2'], borderRadius: radii['radius-pill'] },
  targetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing['space-3'],
  },
  targetDetails: { flexGrow: 1, flexBasis: 124, gap: spacing['space-1'] },
  historyHead: { gap: spacing['space-1'], marginBottom: spacing['space-2'] },
  historyCard: {
    borderRadius: radii['radius-md'],
    padding: spacing['space-3'],
    gap: spacing['space-2'],
  },
  historyMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing['space-4'],
    rowGap: spacing['space-1'],
  },
  historySeparator: { height: spacing['space-2'] },
});
