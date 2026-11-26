import { getTranslation } from '@/i18n/catalog';
import { Feather } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLanguage } from '@/i18n/Language';
import { ChartMetricSelector } from '@/components/ChartMetricSelector';
import { Button } from '@/components/Button';
import { EvolutionGraph } from '@/components/EvolutionGraph';
import { ScreenHeader, screenContentStyle } from '@/components/ScreenHeader';
import { Toast } from '@/components/Toast';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
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
type Editor =
  | { kind: 'measurement' }
  | { kind: 'target'; objective: Objective; target: PhysicalTarget['target'] };

function updateMeasurementHistory(
  previous: { items: BodyMeasurement[] } | undefined,
  measurement: BodyMeasurement,
) {
  if (!previous) return previous;
  return {
    items: [...previous.items.filter((item) => item.id !== measurement.id), measurement].sort(
      (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
    ),
  };
}

export function ProgressScreen({
  account,
  onClose,
}: Readonly<{ account: Account; onClose: () => void }>) {
  const p = usePalette();
  const language = useLanguage();
  const es = language === 'es';
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
  const label = es ? measurementDefinitions[metric].labelEs : measurementDefinitions[metric].label;

  function measurementSaved(measurement: BodyMeasurement) {
    const measured = measurementMetrics.find((key) => measurement[key] !== null);
    if (measured && measurement[metric] === null) setMetric(measured);
    setSelected(null);
    setEditor(null);
    setToast(getTranslation(language)('accountsUi.measurements_saved'));
    const queryKey = measurementKey(accountId);
    void cache.cancelQueries({ queryKey, exact: true });
    cache.setQueryData<typeof measurements.data>(queryKey, (previous) =>
      updateMeasurementHistory(previous, measurement),
    );
    void cache.invalidateQueries({ queryKey });
    void cache.invalidateQueries({ queryKey: ['accounts', accountId, 'me'], exact: true });
  }

  function targetSaved(result: PhysicalTarget) {
    const queryKey = targetKey(accountId);
    void cache.cancelQueries({ queryKey, exact: true });
    cache.setQueryData(queryKey, result);
    setEditor(null);
    setToast(getTranslation(language)('accountsUi.weight_target_saved'));
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
              <ScreenHeader
                title={getTranslation(language)('accountsUi.progress')}
                leading={<ProfileBack onPress={onClose} />}
              />
              <Button
                title={getTranslation(language)('accountsUi.log_measurements')}
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
                  {getTranslation(language)('accountsUi.measurement_trends')}
                </Text>
                <ChartMetricSelector
                  metrics={measurementMetrics}
                  value={metric}
                  label={getTranslation(language)('accountsUi.measurement_metric')}
                  labelFor={(key) =>
                    es ? measurementDefinitions[key].labelEs : measurementDefinitions[key].label
                  }
                  onChange={(key) => {
                    setMetric(key);
                    setSelected(null);
                  }}
                />
                {measurements.isPending ? (
                  <ActivityIndicator
                    accessibilityLabel={getTranslation(language)('accountsUi.loading_measurements')}
                    color={p.brand}
                  />
                ) : null}
                {measurements.isError ? (
                  <LoadProblem
                    message={getTranslation(language)('accountsUi.could_not_load_measurements')}
                    onRetry={() => void measurements.refetch()}
                  />
                ) : null}
                {measurements.data ? (
                  <>
                    {highlighted ? <MeasurementHeadline highlighted={highlighted} /> : null}
                    <EvolutionGraph
                      testID="body-measurement-chart"
                      points={points}
                      emptyState={
                        measurements.isError
                          ? undefined
                          : {
                              title: getTranslation(language)(
                                'dynamicMessages.noMeasurementsYet_159e47',
                                { value1: label.toLowerCase() },
                              ),
                              hint: getTranslation(language)(
                                'accountsUi.log_a_measurement_to_start_tracking',
                              ),
                            }
                      }
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
                    {getTranslation(language)('accountsUi.weight_target')}
                  </Text>
                </View>
                {target.isPending ? (
                  <ActivityIndicator
                    accessibilityLabel={getTranslation(language)(
                      'accountsUi.loading_weight_target',
                    )}
                    color={p.brand}
                  />
                ) : null}
                {target.isError ? (
                  <LoadProblem
                    message={getTranslation(language)(
                      'accountsUi.could_not_load_your_weight_target',
                    )}
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
                  {getTranslation(language)('accountsUi.measurement_history')}
                </Text>
                {measurements.isSuccess && items.length === 0 ? (
                  <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                    {getTranslation(language)('accountsUi.saved_check_ins_will_appear_here')}
                  </Text>
                ) : null}
              </View>
            </View>
          }
        />
      </View>
      {toast ? <Toast message={toast} onDismiss={dismissToast} /> : null}
      <ProgressEditor
        editor={editor}
        system={system}
        timezone={account.profile.timezone}
        history={items}
        onClose={() => setEditor(null)}
        onMeasurementSaved={measurementSaved}
        onTargetSaved={targetSaved}
        onObjectiveChanged={() => void target.refetch()}
      />
    </SafeAreaView>
  );
}

function ProgressEditor({
  editor,
  system,
  timezone,
  history,
  onClose,
  onMeasurementSaved,
  onTargetSaved,
  onObjectiveChanged,
}: Readonly<{
  editor: Editor | null;
  system: MeasurementSystem;
  timezone: Account['profile']['timezone'];
  history: readonly BodyMeasurement[];
  onClose: () => void;
  onMeasurementSaved: (measurement: BodyMeasurement) => void;
  onTargetSaved: (target: PhysicalTarget) => void;
  onObjectiveChanged: () => void;
}>) {
  if (editor?.kind === 'measurement')
    return (
      <MeasurementEditor
        system={system}
        timeZone={timezone}
        history={history}
        onClose={onClose}
        onSaved={onMeasurementSaved}
      />
    );
  if (editor?.kind === 'target')
    return (
      <PhysicalTargetEditor
        system={system}
        objective={editor.objective}
        target={editor.target}
        timeZone={timezone}
        onClose={onClose}
        onSaved={onTargetSaved}
        onObjectiveChanged={onObjectiveChanged}
      />
    );
  return null;
}

function MeasurementHeadline({
  highlighted,
}: Readonly<{ highlighted: ReturnType<typeof measurementSeries>[number] }>) {
  const p = usePalette();
  const language = useLanguage();
  return (
    <View style={styles.metric}>
      <Text style={[textStyles['metric-lg'], styles.numbers, { color: p.ink }]}>
        {highlighted.label}
      </Text>
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        {displayProgressDate(highlighted.date, language)}
      </Text>
    </View>
  );
}

function LoadProblem({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  const p = usePalette();
  const language = useLanguage();
  return (
    <View style={styles.metric}>
      <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
        {message}
      </Text>
      <Button
        title={getTranslation(language)('accountsUi.retry')}
        shape="rounded"
        accessibilityLabel={`${getTranslation(language)('accountsUi.retry')}. ${message}`}
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
  const language = useLanguage();
  const es = language === 'es';
  const { objective, target } = data;
  if (!objective) {
    return (
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        {getTranslation(language)(
          'accountsUi.choose_an_objective_in_profile_to_set_a_weight_target',
        )}
      </Text>
    );
  }
  return (
    <View style={styles.targetRow}>
      <View style={styles.targetDetails}>
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {(() => {
            const option = objectiveOptions.find((item) => item.value === objective);
            const label = es ? option?.labelEs : option?.label;
            return label ?? '';
          })()}
        </Text>
        {target ? (
          <>
            <Text style={[textStyles['metric-md'], styles.numbers, { color: p.ink }]}>
              {shownMeasurement('weight_kg', target.weight_kg, system)}
            </Text>
            {target.target_date ? (
              <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                {getTranslation(language)('accountsUi.target_date')} ·{' '}
                {displayProgressDate(target.target_date, language)}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={[textStyles.body, { color: p.ink }]}>
            {getTranslation(language)('accountsUi.no_weight_target_set')}
          </Text>
        )}
      </View>
      <Button
        title={
          target
            ? getTranslation(language)('accountsUi.edit_target')
            : getTranslation(language)('accountsUi.set_target')
        }
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
  const language = useLanguage();
  const es = language === 'es';
  return (
    <View style={[styles.historyCard, { backgroundColor: p['surface-200'] }]}>
      <Text style={[textStyles.label, { color: p.ink }]}>
        {displayProgressDate(item.date, language)}
      </Text>
      <View style={styles.historyMetrics}>
        {measurementMetrics.map((metric) => {
          const raw = item[metric];
          if (raw === null) return null;
          return (
            <Text
              key={metric}
              style={[textStyles['body-sm'], styles.numbers, { color: p['ink-muted'] }]}
            >
              {es ? measurementDefinitions[metric].labelEs : measurementDefinitions[metric].label}{' '}
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
