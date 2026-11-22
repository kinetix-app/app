import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { exerciseLine } from '../workoutFormat';
import { IconButton } from './ui';

type Action = Readonly<{ label: string; onPress: () => void }>;

/** A summary from already-loaded list or post data. The caller opens the appropriate detail. */
export function WorkoutSummaryCard({
  title,
  subtitle,
  metrics,
  exerciseNames,
  open,
  share,
  embedded = false,
  testID,
}: Readonly<{
  title: string;
  subtitle: string;
  metrics: readonly { label: string; value: string }[];
  exerciseNames: readonly string[];
  open?: Action;
  share?: Action;
  embedded?: boolean;
  testID?: string;
}>) {
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  const names = exerciseLine(exerciseNames);
  const summary = (
    <>
      <View style={[styles.header, share && styles.withShare]}>
        <View style={[styles.icon, { backgroundColor: p['brand-soft'] }]}>
          <Feather name="activity" size={18} color={p['brand-ink']} />
        </View>
        <View style={styles.heading}>
          <Text style={[textStyles['title-md'], { color: p.ink }]}>{title}</Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{subtitle}</Text>
        </View>
        {open ? <Feather name="chevron-right" size={20} color={p['brand-ink']} /> : null}
      </View>
      <View style={[styles.metrics, { borderColor: p.line }]}>
        {metrics.map(({ label, value }) => (
          <View key={label} style={styles.metric}>
            <Text style={[textStyles.label, styles.tabular, { color: p.ink }]}>{value}</Text>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{label}</Text>
          </View>
        ))}
      </View>
      {names ? (
        <Text numberOfLines={2} style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {names}
        </Text>
      ) : null}
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
          accessibilityHint={[...metrics.map(({ label, value }) => `${label}: ${value}`), names]
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
      {share ? (
        <View style={styles.share}>
          <IconButton icon="share" label={share.label} onPress={share.onPress} />
        </View>
      ) : null}
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
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-3'] },
  withShare: { paddingRight: sizes['tap-min'] },
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
    flexWrap: 'wrap',
    gap: spacing['space-2'],
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing['space-2'],
  },
  metric: { flexBasis: '28%', flexGrow: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  share: { position: 'absolute', top: spacing['space-3'], right: spacing['space-3'] },
});
