import React, { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import type { ExerciseSummary } from '../schemas';
import { ui } from './ui';

export function WorkoutTimer({
  startedAt,
  endedAt,
  compact = false,
  onOverlay = false,
}: Readonly<{
  startedAt: string;
  endedAt?: string;
  compact?: boolean;
  onOverlay?: boolean;
}>) {
  const p = usePalette();
  const foreground = onOverlay ? p['overlay-ink'] : p['brand-ink'];
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(
    0,
    Math.floor(((endedAt ? Date.parse(endedAt) : now) - Date.parse(startedAt)) / 1000),
  );
  const hours = Math.floor(seconds / 3600);
  const time = formatElapsedTime(hours, seconds);
  return (
    <View style={ui.row}>
      <Feather name="clock" size={18} color={foreground} />
      <Text
        accessibilityLabel={`Workout duration ${time}`}
        style={[
          compact ? textStyles.label : textStyles['title-md'],
          { color: foreground, fontVariant: ['tabular-nums'] },
        ]}
      >
        {time}
      </Text>
    </View>
  );
}

function formatElapsedTime(hours: number, seconds: number) {
  const hourPrefix = hours > 0 ? `${hours}:` : '';
  const minutes = String(Math.floor(seconds / 60) % 60).padStart(2, '0');
  const remainder = String(seconds % 60).padStart(2, '0');
  return `${hourPrefix}${minutes}:${remainder}`;
}

/** Shared inline exercise editor. Name toggles sets; image opens catalogue information. */
export function WorkoutExerciseCard({
  exercise,
  summary,
  onSets,
  onDetails,
  disabled,
  active,
  expanded = false,
  dragHandle,
  children,
}: React.PropsWithChildren<{
  exercise: ExerciseSummary;
  summary: React.ReactNode;
  onSets: () => void;
  onDetails: () => void;
  disabled: boolean;
  active?: boolean;
  expanded?: boolean;
  dragHandle: React.ReactNode;
}>) {
  const p = usePalette();
  return (
    <View
      style={[
        ui.card,
        {
          backgroundColor: active ? p['surface-300'] : p['surface-200'],
          borderWidth: 1,
          borderColor: active ? p.brand : p['surface-200'],
        },
      ]}
    >
      <View style={[ui.row, { alignItems: 'flex-start' }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Details for ${exercise.name}`}
          onPress={onDetails}
          disabled={disabled}
          style={{
            width: '32%',
            minHeight: 100,
            borderRadius: radii['radius-md'],
            backgroundColor: p['surface-300'],
            overflow: 'hidden',
          }}
        >
          {exercise.image_url ? (
            <Image
              source={{ uri: exercise.image_url }}
              accessibilityLabel={exercise.name}
              resizeMode="contain"
              style={{ width: '100%', height: 100 }}
            />
          ) : (
            <View style={{ minHeight: 100, justifyContent: 'center', padding: spacing['space-3'] }}>
              <Text style={{ color: p['ink-muted'] }}>No image</Text>
            </View>
          )}
        </Pressable>
        <View style={{ flex: 1, gap: spacing['space-2'] }}>
          <View style={[ui.row, { alignItems: 'flex-start', gap: spacing['space-1'] }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit sets for ${exercise.name}`}
              aria-expanded={expanded}
              accessibilityState={{ expanded, disabled }}
              onPress={onSets}
              disabled={disabled}
              style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={[textStyles.label, { color: p.ink }]}>{exercise.name}</Text>
            </Pressable>
            {dragHandle}
          </View>
          {summary}
        </View>
      </View>
      {expanded ? <View style={ui.gap}>{children}</View> : null}
    </View>
  );
}
