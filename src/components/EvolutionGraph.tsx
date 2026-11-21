import React, { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

export type EvolutionPoint = Readonly<{ date: string; value: number; label: string }>;

const plotHeight = 150;
const touchRadius = sizes['tap-min'] / 2;
const rightInset = touchRadius;

type EvolutionGraphProps = Readonly<{
  /** Ordered by date with no more than one point per date. */
  points: readonly EvolutionPoint[];
  selected: string | null;
  onSelect: (date: string | null) => void;
  formatAxis: (value: number, showUnit: boolean) => string;
  opacity?: Animated.Value;
  testID?: string;
}>;

export function EvolutionGraph({
  points,
  selected,
  onSelect,
  formatAxis,
  opacity,
  testID,
}: EvolutionGraphProps) {
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const axisWidth = Math.ceil(54 * fontScale);
  const leftInset = axisWidth + spacing['space-2'];
  const plotWidth = Math.max(0, width - leftInset - rightInset);
  const first = points[0];
  const last = points.at(-1);
  const bounds = first && axisBounds(points, first.value);
  const start = first ? Date.parse(first.date) : 0;
  const dateSpan = last ? Date.parse(last.date) - start : 0;
  const plotted = bounds
    ? points.map((point) => ({
        ...point,
        x:
          leftInset +
          (dateSpan ? ((Date.parse(point.date) - start) / dateSpan) * plotWidth : plotWidth / 2),
        y: touchRadius + ((bounds.max - point.value) / (bounds.max - bounds.min)) * plotHeight,
      }))
    : [];
  const active = plotted.find((point) => point.date === selected);
  return (
    <Animated.View
      testID={testID}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.chart, { opacity }]}
    >
      {[0, 0.5, 1].map((line) => (
        <View
          key={line}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: touchRadius + line * plotHeight,
            left: leftInset,
            right: rightInset,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: p['line-strong'],
          }}
        />
      ))}
      {bounds ? (
        <>
          <Text
            style={[styles.axis, { color: p['ink-muted'], top: touchRadius, width: axisWidth }]}
          >
            {formatAxis(bounds.max, true)}
          </Text>
          <Text
            style={[
              styles.axis,
              { color: p['ink-muted'], top: touchRadius + plotHeight - 16, width: axisWidth },
            ]}
          >
            {formatAxis(bounds.min, false)}
          </Text>
        </>
      ) : null}
      {plotted.slice(1).map((point, i) => {
        const prev = plotted[i];
        const dx = point.x - prev.x;
        const dy = point.y - prev.y;
        const length = Math.hypot(dx, dy);
        return (
          <View
            key={point.date}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: (prev.x + point.x - length) / 2,
              top: (prev.y + point.y) / 2,
              width: length,
              height: 1,
              backgroundColor: p.brand,
              transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
            }}
          />
        );
      })}
      {plotted.map((point) => (
        <Pressable
          key={point.date}
          accessibilityRole="button"
          accessibilityLabel={`${point.date}, ${point.label}`}
          accessibilityState={{ selected: selected === point.date }}
          aria-selected={selected === point.date}
          onPress={() => onSelect(selected === point.date ? null : point.date)}
          style={[styles.point, { left: point.x - touchRadius, top: point.y - touchRadius }]}
        >
          <View
            style={[
              styles.dot,
              { backgroundColor: p.brand },
              selected === point.date && { borderWidth: 2, borderColor: p.ink },
            ]}
          />
        </Pressable>
      ))}
      {active ? (
        <Text
          pointerEvents="none"
          style={[
            styles.tooltip,
            {
              top: Math.max(0, active.y - sizes['tap-min']),
              color: p.ink,
              backgroundColor: p['surface-300'],
            },
          ]}
        >
          {active.date} · {active.label}
        </Text>
      ) : null}
      {first && last ? (
        <View
          pointerEvents="none"
          style={[styles.dates, { marginLeft: leftInset, marginRight: rightInset }]}
        >
          <Text style={[textStyles.caption, { color: p['ink-muted'] }]}>{first.date}</Text>
          {last.date !== first.date ? (
            <Text style={[textStyles.caption, { color: p['ink-muted'] }]}>{last.date}</Text>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

function axisBounds(points: readonly EvolutionPoint[], initial: number) {
  let low = initial;
  let high = initial;
  for (const { value } of points) {
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  const padding = high === low ? Math.max(Math.abs(high) * 0.1, 1) : (high - low) * 0.1;
  return { min: low < 0 ? low - padding : Math.max(0, low - padding), max: high + padding };
}

const styles = StyleSheet.create({
  chart: { minHeight: plotHeight + sizes['tap-min'] },
  axis: { ...textStyles.caption, position: 'absolute', left: 0 },
  point: {
    position: 'absolute',
    width: sizes['tap-min'],
    height: sizes['tap-min'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tooltip: {
    ...textStyles.caption,
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: spacing['space-2'],
    paddingVertical: spacing['space-1'],
    borderRadius: radii['radius-sm'],
  },
  dates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing['space-1'],
    paddingTop: plotHeight + sizes['tap-min'],
  },
});
