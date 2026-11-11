import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AccessibilityInfo,
  Animated,
  LayoutAnimation,
  Modal,
  Pressable,
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
import { AnimatedTextSelector } from './AnimatedTextSelector';

// React Native Web supports this CSS property; native ViewStyle does not declare it.
const gestureHandleStyle: ViewStyle & { touchAction?: 'none' } =
  Platform.OS === 'web' ? { touchAction: 'none' } : {};

type Metric = 'estimated_1rm' | 'weight' | 'volume' | 'reps' | 'distance' | 'duration_seconds';
type Range = 1 | 3 | 6 | 12 | 'All';
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
function rangeLabel(range: Range): string {
  if (range === 'All') return range;
  if (range === 12) return '1 year';
  return `${range} month${range === 1 ? '' : 's'}`;
}
function emptyMessage(hasValues: boolean, hasHistory: boolean): string {
  if (hasValues) return 'No data in this period. Try a longer range.';
  if (hasHistory) return 'This metric is unavailable for the recorded sets.';
  return 'No data in this period. No observations are available yet.';
}
function metricUnitExplanation(metric: Metric, weight: string, distance: string): string {
  if (metric === 'distance') return `Distance is shown in ${distance}.`;
  if (metric === 'duration_seconds') return 'Time is shown in hours, minutes and seconds.';
  if (metric === 'reps') return '';
  return `Load is shown in ${weight}.`;
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
  if (!current) return <>{labels[metric]}</>;
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
  const imperial = account.data?.profile.measurement_system === 'imperial';
  const weight = imperial ? 'lb' : 'kg',
    distance = imperial ? 'mi' : 'km';
  const query = useQuery({
    queryKey: ['training', accountId, 'exercise', exerciseId, 'evolution', weight, distance],
    queryFn: ({ signal }) => trainingApi.exerciseEvolution(exerciseId, weight, distance, signal),
    enabled: !!account.data,
  });
  const today = new Date().toISOString().slice(0, 10);
  const start = range === 'All' ? '' : rangeStart(new Date(), range);
  const history = (query.data?.days ?? []).filter((d) => d.date <= today);
  const all = history.filter((d) => d[metric] !== null);
  const visible = all.filter((d) => d.date >= start);
  const current = visible.find((d) => d.date === selected) ?? visible.at(-1);
  return (
    <View style={{ gap: 12 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        contentContainerStyle={{ gap: 16 }}
      >
        {(cardio
          ? ['distance', 'duration_seconds']
          : ['estimated_1rm', 'weight', 'volume', 'reps']
        ).map((item) => {
          const key = item as Metric;
          return (
            <AnimatedTextSelector
              key={key}
              label={labels[key]}
              selected={metric === key}
              role="tab"
              reduceMotion={reduceMotion}
              onPress={() => {
                animate();
                setMetric(key);
                setSelected(null);
              }}
            />
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text accessibilityRole="header" style={{ color: p.ink, fontSize: 20, fontWeight: '700' }}>
          <MetricHeadline current={current} metric={metric} weight={weight} distance={distance} />
        </Text>
        <IconButton
          icon="info"
          label={`About ${labels[metric]}`}
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
      {query.data && !current ? (
        <Text style={{ color: p['ink-muted'] }}>
          {emptyMessage(all.length > 0, history.length > 0)}
        </Text>
      ) : null}
      {current ? (
        <>
          <Text style={{ color: p['ink-muted'] }}>
            {current.date}
            {metric === 'volume' && current.volume_partial ? ' · Some sets excluded' : ''}
          </Text>
          <EvolutionGraph
            visible={visible}
            metric={metric}
            weight={weight}
            distance={distance}
            selected={selected}
            setSelected={setSelected}
            opacity={opacity}
          />
        </>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {([1, 3, 6, 12, 'All'] as Range[]).map((r) => (
          <AnimatedTextSelector
            key={r}
            label={rangeLabel(r)}
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

function EvolutionGraph({
  visible,
  metric,
  weight,
  distance,
  selected,
  setSelected,
  opacity,
}: Readonly<{
  visible: EvolutionDay[];
  metric: Metric;
  weight: string;
  distance: string;
  selected: string | null;
  setSelected: React.Dispatch<React.SetStateAction<string | null>>;
  opacity: Animated.Value;
}>) {
  const p = usePalette();
  const [width, setWidth] = useState(0);
  const numbers = visible.map((d) => Number(d[metric]));
  const low = Math.min(...numbers),
    high = Math.max(...numbers);
  const padding = high === low ? Math.max(Math.abs(high) * 0.1, 1) : (high - low) * 0.1;
  const min = Math.max(0, low - padding),
    max = high + padding;
  const plotWidth = Math.max(0, width - 92),
    height = 150;
  const points = visible.map((d) => ({
    day: d,
    x:
      visible.length === 1
        ? plotWidth / 2
        : ((Date.parse(d.date) - Date.parse(visible[0].date)) /
            (Date.parse(visible.at(-1)?.date ?? visible[0].date) - Date.parse(visible[0].date))) *
          plotWidth,
    y: max === min ? height / 2 : height - ((Number(d[metric]) - min) / (max - min)) * height,
  }));
  return (
    <Animated.View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: 205, paddingLeft: 48, opacity }}
    >
      {[0, 0.5, 1].map((v) => (
        <View
          key={v}
          style={{
            position: 'absolute',
            left: 48,
            right: 0,
            top: v * height,
            borderTopWidth: 1,
            borderColor: p['surface-300'],
          }}
        />
      ))}
      <Text style={{ position: 'absolute', left: 0, top: 0, color: p['ink-muted'], fontSize: 10 }}>
        {max.toFixed(axisPrecision(metric))} {metricUnit(metric, weight, distance)}
      </Text>
      <Text
        style={{
          position: 'absolute',
          left: 0,
          top: height - 12,
          color: p['ink-muted'],
          fontSize: 10,
        }}
      >
        {min.toFixed(axisPrecision(metric))}
      </Text>
      {points.slice(1).map((point, i) => {
        const prev = points[i];
        const dx = point.x - prev.x,
          dy = point.y - prev.y;
        return (
          <View
            key={point.day.date}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 70 + (prev.x + point.x) / 2 - Math.hypot(dx, dy) / 2,
              top: (prev.y + point.y) / 2,
              width: Math.hypot(dx, dy),
              height: 1,
              backgroundColor: p.brand,
              transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
            }}
          />
        );
      })}
      {points.map((point) => (
        <Pressable
          key={point.day.date}
          accessibilityRole="button"
          accessibilityLabel={`${point.day.date}, ${value(point.day, metric, weight, distance)}`}
          accessibilityState={{ selected: selected === point.day.date }}
          aria-selected={selected === point.day.date}
          onPress={() => setSelected(selected === point.day.date ? null : point.day.date)}
          style={{
            position: 'absolute',
            left: 70 + point.x - 22,
            top: point.y - 22,
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: p.brand }} />
        </Pressable>
      ))}
      {selected &&
        points
          .filter((point) => point.day.date === selected)
          .map((point) => (
            <Text
              key={point.day.date}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: Math.max(48, Math.min(width - 130, 75 + point.x)),
                top: Math.max(0, point.y - 35),
                color: p.ink,
                backgroundColor: p['surface-300'],
                fontSize: 12,
              }}
            >
              {point.day.date} · {value(point.day, metric, weight, distance)}
            </Text>
          ))}
      <Text
        style={{
          position: 'absolute',
          left: 48,
          top: height + 25,
          color: p['ink-muted'],
          fontSize: 10,
        }}
      >
        {visible[0].date}
      </Text>
      <Text
        style={{
          position: 'absolute',
          right: 0,
          top: height + 25,
          color: p['ink-muted'],
          fontSize: 10,
        }}
      >
        {visible.length > 1 ? visible.at(-1)?.date : ''}
      </Text>
    </Animated.View>
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
                  {labels[metric]}
                </Text>
                <IconButton icon="x" label="Close explanation" onPress={() => onClose()} />
              </View>
              <Text style={{ color: p.ink, lineHeight: 22 }}>
                {descriptions[metric]} {metricUnitExplanation(metric, weight, distance)}
              </Text>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}
