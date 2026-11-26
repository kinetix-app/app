import React, { useEffect, useState } from 'react';
import { selectCopy, useLanguage } from '@/i18n/Language';
import { useQuery } from '@tanstack/react-query';
import {
  AccessibilityInfo,
  Animated,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAccount } from '@/features/accounts/api';
import { usePalette } from '@/theme/tokens';
import { trainingApi } from '../api';
import type { EvolutionDay } from '../schemas';
import { Failure, IconButton, Loading } from './ui';
import { AnimatedTextSelector } from '@/components/AnimatedTextSelector';
import { ChartMetricSelector } from '@/components/ChartMetricSelector';
import { EvolutionGraph } from '@/components/EvolutionGraph';

// React Native Web supports this CSS property; native ViewStyle does not declare it.
const gestureHandleStyle: ViewStyle & { touchAction?: 'none' } =
  Platform.OS === 'web' ? { touchAction: 'none' } : {};

type Metric = 'estimated_1rm' | 'weight' | 'volume' | 'reps' | 'distance' | 'duration_seconds';
type Range = 1 | 3 | 6 | 12 | 'All';
const gymMetrics: readonly Metric[] = ['estimated_1rm', 'weight', 'volume', 'reps'];
const cardioMetrics: readonly Metric[] = ['distance', 'duration_seconds'];
const labels: Record<Metric, string> = {
  estimated_1rm: 'Estimated strength (1RM)',
  weight: 'Weight',
  volume: 'Volume',
  reps: 'Reps',
  distance: 'Distance',
  duration_seconds: 'Time',
};
const descriptions: Record<Metric, string> = {
  estimated_1rm:
    'The highest estimated one-repetition maximum uses positive recorded load × (1 + reps / 30) for 2–10 reps, and recorded load for one rep. Sets over 10 reps are ineligible. This is an estimate; we do not know how close a set was to maximum effort. For assisted or bodyweight exercises, recorded load may not represent total load or actual strength. Body weight and assistance direction are not inferred.',
  weight:
    'The highest recorded load in an individual set that day. For assisted or bodyweight exercises, recorded load may not represent total load.',
  volume:
    'The sum of recorded load multiplied by repetitions for eligible sets that day. Incomplete or incompatible sets are excluded. For assisted or bodyweight exercises, this uses recorded load and may not represent total load.',
  reps: 'The highest repetitions in an individual set that day.',
  distance: 'The longest distance in an individual set that day, not the sum of sets.',
  duration_seconds: 'The longest time in an individual set that day, not the sum of sets.',
};
const spanishLabels: Record<Metric, string> = {
  estimated_1rm: 'Fuerza estimada (1RM)',
  weight: 'Peso',
  volume: 'Volumen',
  reps: 'Repeticiones',
  distance: 'Distancia',
  duration_seconds: 'Tiempo',
};
const spanishDescriptions: Record<Metric, string> = {
  estimated_1rm:
    'La repetición máxima estimada más alta usa la carga registrada × (1 + repeticiones / 30) para series de 2 a 10 repeticiones y la carga registrada para una sola repetición. Se excluyen las series de más de 10 repeticiones. Es una estimación: no sabemos cuánto se acercó cada serie al esfuerzo máximo. En ejercicios asistidos o con el peso corporal, la carga registrada puede no representar la carga total ni la fuerza real.',
  weight:
    'La mayor carga registrada en una sola serie de ese día. En ejercicios asistidos o con el peso corporal, puede no representar la carga total.',
  volume:
    'La suma de la carga registrada por las repeticiones de las series válidas del día. Se excluyen las series incompletas o incompatibles. En ejercicios asistidos o con el peso corporal, puede no representar la carga total.',
  reps: 'El mayor número de repeticiones en una sola serie de ese día.',
  distance: 'La mayor distancia de una sola serie de ese día, sin sumar las series.',
  duration_seconds: 'La mayor duración de una sola serie de ese día, sin sumar las series.',
};
export function rangeStart(today: Date, months: number): string {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() - months;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(today.getUTCDate(), last)))
    .toISOString()
    .slice(0, 10);
}
export function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60),
    s = seconds % 60;
  return [h ? `${h}h` : '', m ? `${m}m` : '', s ? `${s}s` : ''].filter(Boolean).join(' ') || '0s';
}
function value(day: EvolutionDay, metric: Metric, weight: string, distance: string) {
  const raw = day[metric];
  if (raw === null) return '';
  if (metric === 'duration_seconds') return duration(Number(raw));
  const unit = metricUnit(metric, weight, distance);
  const formatted = metric === 'reps' ? raw : Number(raw).toFixed(axisPrecision(metric));
  return `${formatted} ${unit}`;
}
function metricUnit(metric: Metric, weight: string, distance: string): string {
  if (metric === 'distance') return distance;
  if (metric === 'reps') return 'reps';
  if (metric === 'duration_seconds') return 's';
  return weight;
}
function axisPrecision(metric: Metric): number {
  if (metric === 'distance') return 2;
  if (metric === 'reps' || metric === 'duration_seconds') return 0;
  return 1;
}
function evolutionUnits(imperial: boolean): { weight: 'kg' | 'lb'; distance: 'km' | 'mi' } {
  return imperial ? { weight: 'lb', distance: 'mi' } : { weight: 'kg', distance: 'km' };
}
function rangeLabel(range: Range, es: boolean): string {
  if (es) {
    if (range === 'All') return 'Todo';
    if (range === 12) return '1 año';
    return range === 1 ? '1 mes' : `${range} meses`;
  }
  if (range === 'All') return range;
  if (range === 12) return '1 year';
  return `${range} month${range === 1 ? '' : 's'}`;
}
function emptyMessage(hasValues: boolean, hasHistory: boolean, es: boolean): string {
  if (es) {
    if (hasValues) return 'No hay datos en este período. Prueba un período más largo.';
    if (hasHistory) return 'Esta métrica no está disponible para las series registradas.';
    return 'Aún no hay observaciones para este período.';
  }
  if (hasValues) return 'No data in this period. Try a longer range.';
  if (hasHistory) return 'This metric is unavailable for the recorded sets.';
  return 'No data in this period. No observations are available yet.';
}
function metricUnitExplanation(
  metric: Metric,
  weight: string,
  distance: string,
  es: boolean,
): string {
  if (es) {
    if (metric === 'distance') return `La distancia se muestra en ${distance}.`;
    if (metric === 'duration_seconds') return 'El tiempo se muestra en horas, minutos y segundos.';
    if (metric === 'reps') return '';
    return `La carga se muestra en ${weight}.`;
  }
  if (metric === 'distance') return `Distance is shown in ${distance}.`;
  if (metric === 'duration_seconds') return 'Time is shown in hours, minutes and seconds.';
  if (metric === 'reps') return '';
  return `Load is shown in ${weight}.`;
}
function selectEvolutionDays(
  days: EvolutionDay[],
  metric: Metric,
  range: Range,
  selected: string | null,
) {
  const today = new Date().toISOString().slice(0, 10);
  const start = range === 'All' ? '' : rangeStart(new Date(), range);
  const history = days.filter((day) => day.date <= today);
  const all = history.filter((day) => day[metric] !== null);
  const visible = all.filter((day) => day.date >= start);
  const current = visible.find((day) => day.date === selected) ?? visible.at(-1);
  return { history, all, visible, current };
}
function MetricHeadline({
  current,
  metric,
  weight,
  distance,
}: Readonly<{
  current: EvolutionDay | undefined;
  metric: Metric;
  weight: string;
  distance: string;
}>) {
  const language = useLanguage();
  if (!current) return <>{(language === 'es' ? spanishLabels : labels)[metric]}</>;
  if (metric !== 'duration_seconds') return <>{value(current, metric, weight, distance)}</>;
  return (
    <>
      {duration(Number(current.duration_seconds))
        .split(/([hms])/)
        .map((part, i) => (
          <Text key={`${part}-${i}`} style={{ fontSize: /^[hms]$/.test(part) ? 12 : 20 }}>
            {part}
          </Text>
        ))}
    </>
  );
}

export function ExerciseEvolution({
  accountId,
  exerciseId,
  activityType,
}: Readonly<{ accountId: number; exerciseId: number; activityType: string }>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const metricLabels = es ? spanishLabels : labels;
  const cardio = activityType === 'cardio';
  const [metric, setMetric] = useState<Metric>(cardio ? 'distance' : 'estimated_1rm');
  const [range, setRange] = useState<Range>(3);
  const [selected, setSelected] = useState<string | null>(null);
  const [info, setInfo] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  const animate = () => {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      opacity.setValue(0.7);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  };
  const account = useQuery({
    queryKey: ['accounts', accountId, 'me'],
    queryFn: ({ signal }) => getAccount(undefined, signal),
  });
  const { weight, distance } = evolutionUnits(
    account.data?.profile.measurement_system === 'imperial',
  );
  const query = useQuery({
    queryKey: ['training', accountId, 'exercise', exerciseId, 'evolution', weight, distance],
    queryFn: ({ signal }) => trainingApi.exerciseEvolution(exerciseId, weight, distance, signal),
    enabled: !!account.data,
  });
  const { history, all, visible, current } = selectEvolutionDays(
    query.data?.days ?? [],
    metric,
    range,
    selected,
  );
  const excludedSetsLabel = selectCopy(
    es,
    ' · Se excluyeron algunas series',
    ' · Some sets excluded',
  );
  return (
    <View style={{ gap: 12 }}>
      <ChartMetricSelector
        metrics={cardio ? cardioMetrics : gymMetrics}
        value={metric}
        label={selectCopy(es, 'Métrica del ejercicio', 'Exercise metric')}
        labelFor={(key) => metricLabels[key]}
        reduceMotion={reduceMotion}
        onChange={(key) => {
          animate();
          setMetric(key);
          setSelected(null);
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text accessibilityRole="header" style={{ color: p.ink, fontSize: 20, fontWeight: '700' }}>
          <MetricHeadline current={current} metric={metric} weight={weight} distance={distance} />
        </Text>
        <IconButton
          icon="info"
          label={es ? `Acerca de ${metricLabels[metric]}` : `About ${metricLabels[metric]}`}
          onPress={() => setInfo(true)}
          bare
        />
      </View>
      {account.isPending || (query.isPending && !account.isError) ? <Loading /> : null}
      {account.isError ? (
        <Failure
          error={account.error}
          retry={() => {
            void account.refetch();
          }}
        />
      ) : null}
      {query.isError ? (
        <Failure
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : null}
      {current ? (
        <Text style={{ color: p['ink-muted'] }}>
          {current.date}
          {metric === 'volume' && current.volume_partial ? excludedSetsLabel : ''}
        </Text>
      ) : null}
      {query.data ? (
        <EvolutionGraph
          testID="exercise-evolution-chart"
          points={visible.map((day) => ({
            date: day.date,
            value: Number(day[metric]),
            label: value(day, metric, weight, distance),
          }))}
          emptyState={
            query.isError
              ? undefined
              : { title: emptyMessage(all.length > 0, history.length > 0, es) }
          }
          selected={selected}
          onSelect={setSelected}
          formatAxis={(amount, showUnit) =>
            amount.toFixed(axisPrecision(metric)) +
            (showUnit ? ` ${metricUnit(metric, weight, distance)}` : '')
          }
          opacity={opacity}
        />
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {([1, 3, 6, 12, 'All'] as Range[]).map((r) => (
          <AnimatedTextSelector
            key={r}
            label={rangeLabel(r, es)}
            selected={range === r}
            role="button"
            reduceMotion={reduceMotion}
            onPress={() => {
              animate();
              setRange(r);
              setSelected(null);
            }}
          />
        ))}
      </View>
      <MetricInfoSheet
        visible={info}
        onClose={() => setInfo(false)}
        metric={metric}
        weight={weight}
        distance={distance}
        reduceMotion={reduceMotion}
      />
    </View>
  );
}

function MetricInfoSheet({
  visible,
  onClose,
  metric,
  weight,
  distance,
  reduceMotion,
}: Readonly<{
  visible: boolean;
  onClose: () => void;
  metric: Metric;
  weight: string;
  distance: string;
  reduceMotion: boolean;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const metricLabels = es ? spanishLabels : labels;
  const [sheetY] = useState(() => new Animated.Value(0));
  const sheetPan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 4,
    onPanResponderMove: (_, gesture) => sheetY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 60 || gesture.vy > 0.7) onClose();
      Animated.timing(sheetY, {
        toValue: 0,
        duration: reduceMotion ? 0 : 180,
        useNativeDriver: true,
      }).start();
    },
    onPanResponderTerminate: () => sheetY.setValue(0),
  });
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={() => onClose()}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: p.scrim }}>
        <Animated.View style={{ maxHeight: '75%', transform: [{ translateY: sheetY }] }}>
          <SafeAreaView
            style={{
              maxHeight: '100%',
              backgroundColor: p['surface-200'],
              padding: 20,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
            }}
          >
            <View
              {...sheetPan.panHandlers}
              testID="evolution-info-grip"
              style={[
                { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
                gestureHandleStyle,
              ]}
            >
              <View
                style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p['ink-muted'] }}
              />
            </View>
            <ScrollView>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text accessibilityRole="header" style={{ color: p.ink, fontSize: 20, flex: 1 }}>
                  {metricLabels[metric]}
                </Text>
                <IconButton
                  icon="x"
                  label={selectCopy(es, 'Cerrar explicación', 'Close explanation')}
                  onPress={() => onClose()}
                />
              </View>
              <Text style={{ color: p.ink, lineHeight: 22 }}>
                {(es ? spanishDescriptions : descriptions)[metric]}{' '}
                {metricUnitExplanation(metric, weight, distance, es)}
              </Text>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}
