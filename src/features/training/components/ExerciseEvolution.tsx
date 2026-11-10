import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AccessibilityInfo,
  Animated,
  LayoutAnimation,
  Modal,
  Pressable,
  PanResponder,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAccount } from '@/features/accounts/api';
import { usePalette } from '@/theme/tokens';
import { trainingApi } from '../api';
import type { EvolutionDay } from '../schemas';
import { Failure, IconButton, Loading } from './ui';

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
  const unit = metric === 'distance' ? distance : metric === 'reps' ? 'reps' : weight;
  const formatted = metric === 'reps' ? raw : Number(raw).toFixed(metric === 'distance' ? 2 : 1);
  return `${formatted} ${unit}`;
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
  const [sheetY] = useState(() => new Animated.Value(0));
  const sheetPan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 4,
    onPanResponderMove: (_, gesture) => sheetY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 60 || gesture.vy > 0.7) setInfo(false);
      Animated.timing(sheetY, {
        toValue: 0,
        duration: reduceMotion ? 0 : 180,
        useNativeDriver: true,
      }).start();
    },
    onPanResponderTerminate: () => sheetY.setValue(0),
  });
  const [width, setWidth] = useState(0);
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
            (Date.parse(visible[visible.length - 1].date) - Date.parse(visible[0].date))) *
          plotWidth,
    y: max === min ? height / 2 : height - ((Number(d[metric]) - min) / (max - min)) * height,
  }));
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
            <EvolutionSelector
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
          {current
            ? metric === 'duration_seconds'
              ? duration(Number(current.duration_seconds))
                  .split(/([hms])/)
                  .map((part, i) => (
                    <Text key={`${part}-${i}`} style={{ fontSize: /^[hms]$/.test(part) ? 12 : 20 }}>
                      {part}
                    </Text>
                  ))
              : value(current, metric, weight, distance)
            : labels[metric]}
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
          {all.length
            ? 'No data in this period. Try a longer range.'
            : history.length
              ? 'This metric is unavailable for the recorded sets.'
              : 'No data in this period. No observations are available yet.'}
        </Text>
      ) : null}
      {current ? (
        <>
          <Text style={{ color: p['ink-muted'] }}>
            {current.date}
            {metric === 'volume' && current.volume_partial ? ' · Some sets excluded' : ''}
          </Text>
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
            <Text
              style={{ position: 'absolute', left: 0, top: 0, color: p['ink-muted'], fontSize: 10 }}
            >
              {max.toFixed(
                metric === 'distance'
                  ? 2
                  : metric === 'reps' || metric === 'duration_seconds'
                    ? 0
                    : 1,
              )}{' '}
              {metric === 'distance'
                ? distance
                : metric === 'reps'
                  ? 'reps'
                  : metric === 'duration_seconds'
                    ? 's'
                    : weight}
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
              {min.toFixed(
                metric === 'distance'
                  ? 2
                  : metric === 'reps' || metric === 'duration_seconds'
                    ? 0
                    : 1,
              )}
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
        </>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {([1, 3, 6, 12, 'All'] as Range[]).map((r) => (
          <EvolutionSelector
            key={r}
            label={r === 'All' ? r : r === 12 ? '1 year' : `${r} month${r === 1 ? '' : 's'}`}
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
      <Modal
        visible={info}
        transparent
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={() => setInfo(false)}
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
                style={{
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  touchAction: 'none',
                }}
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
                  <IconButton icon="x" label="Close explanation" onPress={() => setInfo(false)} />
                </View>
                <Text style={{ color: p.ink, lineHeight: 22 }}>
                  {descriptions[metric]}{' '}
                  {metric === 'distance'
                    ? `Distance is shown in ${distance}.`
                    : metric === 'duration_seconds'
                      ? 'Time is shown in hours, minutes and seconds.'
                      : metric === 'reps'
                        ? ''
                        : `Load is shown in ${weight}.`}
                </Text>
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

function EvolutionSelector({
  label,
  selected,
  role,
  reduceMotion,
  onPress,
}: Readonly<{
  label: string;
  selected: boolean;
  role: 'tab' | 'button';
  reduceMotion: boolean;
  onPress: () => void;
}>) {
  const p = usePalette();
  const [progress] = useState(() => new Animated.Value(selected ? 1 : 0));
  useEffect(() => {
    const transition = Animated.timing(progress, {
      toValue: selected ? 1 : 0,
      duration: reduceMotion ? 0 : 220,
      useNativeDriver: true,
    });
    transition.start();
    return () => transition.stop();
  }, [selected, reduceMotion, progress]);
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ selected }}
      aria-selected={selected}
      onPress={onPress}
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      <Text style={{ color: selected ? p.brand : p.ink }}>{label}</Text>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: p.brand,
          opacity: progress,
          transform: [
            { scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
          ],
        }}
      />
    </Pressable>
  );
}
