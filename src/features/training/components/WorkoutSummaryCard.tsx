import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { formatElapsedDuration, formatWorkoutVolume } from '../workoutFormat';

type Action = Readonly<{ label: string; onPress: () => void }>;

/** A summary from already-loaded list or post data. The caller opens the appropriate detail. */
export function WorkoutSummaryCard({
  title,
  subtitle,
  durationSeconds,
  volumeKg,
  exerciseCount,
  open,
  embedded = false,
  testID,
}: Readonly<{
  title: string;
  subtitle: string;
  durationSeconds: number;
  volumeKg?: string;
  exerciseCount: number;
  open?: Action;
  embedded?: boolean;
  testID?: string;
}>) {
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  const metrics = [
    { label: 'Duration', value: formatElapsedDuration(durationSeconds) },
    { label: 'Volume', value: formatWorkoutVolume(volumeKg) },
    { label: 'Exercises', value: exerciseCount.toLocaleString() },
  ];
  const summary = (
    <>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: p['brand-soft'] }]}>
          <Feather name="activity" size={18} color={p['brand-ink']} />
        </View>
        <View style={styles.heading}>
          <Text numberOfLines={2} style={[textStyles['title-md'], { color: p.ink }]}>
            {title}
          </Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{subtitle}</Text>
        </View>
        {open ? <Feather name="chevron-right" size={20} color={p['brand-ink']} /> : null}
      </View>
      <View style={[styles.metrics, { borderColor: p.line }]}>
        {metrics.map(({ label, value }, index) => (
          <View
            key={label}
            style={[styles.metric, index > 0 && styles.metricDivider, { borderColor: p.line }]}
          >
            <Text style={[textStyles.label, styles.tabular, { color: p.ink }]}>{value}</Text>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{label}</Text>
          </View>
        ))}
      </View>
    </>
  );

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: p[embedded ? 'surface-300' : 'surface-200'],
          borderColor: p.line,
        },
      ]}
    >
      {open ? (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={open.label}
          accessibilityHint={[
            title,
            subtitle,
            ...metrics.map(({ label, value }) => `${label}: ${value}`),
          ]
            .filter(Boolean)
            .join('. ')}
          onPress={open.onPress}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={({ pressed }) => [
            styles.content,
            { opacity: pressed ? 0.7 : 1 },
            focused && {
              outlineColor: p.focus,
              outlineStyle: 'solid',
              outlineWidth: 2,
              outlineOffset: 2,
            },
          ]}
        >
          {summary}
        </Pressable>
      ) : (
        <View style={styles.content}>{summary}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii['radius-lg'], borderWidth: 1 },
  content: {
    borderRadius: radii['radius-lg'],
    padding: spacing['space-3'],
    gap: spacing['space-2'],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-2'] },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radii['radius-md'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { flex: 1, minWidth: 0, gap: spacing['space-1'] },
  metrics: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing['space-2'],
  },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: spacing['space-1'] },
  metricDivider: { borderLeftWidth: StyleSheet.hairlineWidth },
  tabular: { fontVariant: ['tabular-nums'], textAlign: 'center' },
});
