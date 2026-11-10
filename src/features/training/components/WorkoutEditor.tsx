import React, { useEffect, useState } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import type { ExerciseSummary } from '../schemas';
import { Button, IconButton, ui } from './ui';
import { ActionMenu } from './ActionMenu';
import { SetColumnHeaders } from './SetFields';
import { displayWeight, type ActualSet } from '../sessionDraft';

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

/** Shared header summary for planned values and actual session input. */
export function WorkoutExerciseSummary({
  sets,
  savedCount,
  cardio = false,
}: Readonly<{
  sets: readonly Pick<ActualSet, 'value' | 'unit' | 'reps'>[];
  savedCount?: number;
  cardio?: boolean;
}>) {
  const p = usePalette();
  function range(key: 'reps' | 'value') {
    const values = sets
      .map((set) => {
        const value = key === 'value' ? displayWeight(set.value, set.unit, 'kg') : set.reps;
        return value.trim() ? Number(value) : Number.NaN;
      })
      .filter(Number.isFinite);
    if (!values.length) return '—';
    const low = Math.min(...values);
    const high = Math.max(...values);
    return low === high ? String(low) : `${low}–${high}`;
  }
  const setLabel = sets.length === 1 ? 'set' : 'sets';
  return (
    <View style={{ gap: spacing['space-2'] }}>
      <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
        {savedCount === undefined
          ? `${sets.length} ${setLabel}`
          : `${savedCount} / ${sets.length} sets saved`}
      </Text>
      {!cardio ? (
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {range('reps')} reps · {range('value')} kg
        </Text>
      ) : null}
    </View>
  );
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
  onRemove,
  onAddSet,
  addSetLabel,
  canAddSet = true,
  confirmSets = false,
  children,
  dragId,
  onDrag,
  onMove,
}: React.PropsWithChildren<{
  exercise: ExerciseSummary;
  summary: React.ReactNode;
  onSets: () => void;
  onDetails: () => void;
  disabled: boolean;
  active?: boolean;
  expanded?: boolean;
  onRemove: () => void;
  onAddSet: () => void;
  addSetLabel: string;
  canAddSet?: boolean;
  confirmSets?: boolean;
  dragId?: string;
  onDrag?: () => void;
  onMove?: (delta: number) => void;
}>) {
  const p = usePalette();
  const [actions, setActions] = useState(false);
  return (
    <>
      <Pressable
        aria-hidden={actions}
        accessibilityElementsHidden={actions}
        importantForAccessibility={actions ? 'no-hide-descendants' : 'auto'}
        {...exerciseReorderKeys(onMove, disabled)}
        nativeID={dragId}
        accessible={false}
        accessibilityLabel={dragId ? `Reorder ${exercise.name}` : undefined}
        accessibilityHint={
          dragId ? 'Hold and drag to reorder. Use arrow keys with a keyboard.' : undefined
        }
        disabled={disabled}
        onLongPress={onDrag}
        delayLongPress={250}
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
            nativeID={dragId ? `${dragId}-drag-details` : undefined}
            onPress={onDetails}
            onLongPress={onDrag}
            delayLongPress={250}
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
              <View
                style={{ minHeight: 100, justifyContent: 'center', padding: spacing['space-3'] }}
              >
                <Text style={{ color: p['ink-muted'] }}>No image</Text>
              </View>
            )}
          </Pressable>
          <View style={{ flex: 1, gap: spacing['space-2'] }}>
            <View style={[ui.row, { alignItems: 'flex-start', gap: spacing['space-1'] }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit sets for ${exercise.name}`}
                nativeID={dragId ? `${dragId}-drag-title` : undefined}
                accessibilityHint={dragId ? 'Hold and drag to reorder' : undefined}
                accessibilityActions={
                  onMove
                    ? [
                        { name: 'increment', label: 'Move exercise later' },
                        { name: 'decrement', label: 'Move exercise earlier' },
                      ]
                    : undefined
                }
                onAccessibilityAction={({ nativeEvent }) => {
                  if (!disabled) onMove?.(nativeEvent.actionName === 'increment' ? 1 : -1);
                }}

                aria-expanded={expanded}
                accessibilityState={{ expanded, disabled }}
                onPress={onSets}
                onLongPress={onDrag}
                delayLongPress={250}
                disabled={disabled}
                style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={[textStyles.label, { color: p.ink }]}>{exercise.name}</Text>
              </Pressable>
              <IconButton
                icon="more-horizontal"
                label={`Actions for ${exercise.name}`}
                disabled={disabled}
                onPress={() => setActions(true)}
              />
            </View>
            {summary}
          </View>
        </View>
        {expanded ? (
          <View style={ui.gap}>
            {exercise.activity_type !== 'cardio' ? (
              <SetColumnHeaders confirmation={confirmSets} />
            ) : null}
            {children}
            <Button
              title="Add set"
              accessibilityLabel={addSetLabel}
              onPress={onAddSet}
              tone="positive"
              disabled={disabled || !canAddSet}
            />
          </View>
        ) : null}
      </Pressable>
      {actions ? (
        <ActionMenu
          title="Exercise actions"
          onClose={() => setActions(false)}
          actions={[{ title: 'Remove exercise', tone: 'danger', onPress: onRemove, disabled }]}
        />
      ) : null}
    </>
  );
}

function exerciseReorderKeys(onMove: ((delta: number) => void) | undefined, disabled: boolean) {
  if (Platform.OS !== 'web' || !onMove) return {};
  return {
    onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
      if (disabled || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target !== event.currentTarget &&
        target.closest('input, button, [role="button"], a') &&
        !target.closest('[id$="-drag-title"]')
      )
        return;
      event.preventDefault();
      onMove(event.key === 'ArrowUp' ? -1 : 1);
    },
  };
}
