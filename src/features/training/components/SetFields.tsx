import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { radii, spacing, sizes, usePalette } from '@/theme/tokens';
import type { ActualSet } from '../sessionDraft';
import { displayWeight } from '../sessionDraft';
import { validWeight, type WeightUnit } from '../schemas';
import { Button, ui } from './ui';

export function SetFields({
  set,
  unit,
  label,
  disabled,
  onChange,
  onRemove,
  decimals = 6,
  number,
  onConfirm,
  saved = false,
  guidance,
}: {
  set: ActualSet;
  unit: WeightUnit;
  label: string;
  disabled: boolean;
  decimals?: number;
  number?: number;
  onConfirm?: () => void;
  saved?: boolean;
  guidance?: { reps: number | null; weightKg: string | null };
  onChange: (set: ActualSet) => void;
  onRemove: () => void;
}) {
  const p = usePalette();
  const fieldStyle = [
    ui.field,
    {
      color: p.ink,
      backgroundColor: p['surface-300'],
      borderColor: p['line-strong'],
    },
  ];
  const weightValid = !set.value || validWeight(set.value, set.unit, decimals);
  const validReps =
    !set.reps ||
    (/^\d+$/.test(set.reps) && Number(set.reps) >= 1 && Number(set.reps) <= 2147483647);
  return (
    <View style={ui.gap}>
      <View
        style={[
          ui.row,
          {
            padding: spacing['space-3'],
            borderRadius: radii['radius-md'],
            backgroundColor: saved ? p['brand-soft'] : p['surface-200'],
            borderWidth: onConfirm && !saved ? 1 : 0,
            borderColor: p['line-strong'],
          },
        ]}
      >
        {number ? (
          <View style={{ width: onConfirm ? 44 : 20, alignItems: 'center' }}>
            <Text style={{ color: p['ink-muted'], textAlign: 'center' }}>{number}</Text>
            {onConfirm ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={label.replace(
                  /^Exercise (\d+) set (\d+)$/,
                  'Remove set $2 from exercise $1',
                )}
                onPress={onRemove}
                disabled={disabled}
                style={{ width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Feather name="minus" size={16} color={p['ink-muted']} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <TextInput
            accessibilityLabel={`${label} ${unit}`}
            keyboardType="decimal-pad"
            editable={!disabled}
            value={displayWeight(set.value, set.unit, unit)}
            maxLength={20}
            placeholder={
              guidance?.weightKg != null
                ? Number(displayWeight(guidance.weightKg, 'kg', unit)).toFixed(2)
                : unit
            }
            placeholderTextColor={p['ink-muted']}
            style={[...fieldStyle, { textAlign: 'center' }]}
            onChangeText={(value) => onChange({ ...set, value, unit })}
          />
          <Text style={{ color: p['ink-muted'], textAlign: 'center' }}>{unit}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <TextInput
            accessibilityLabel={`${label} reps`}
            keyboardType="number-pad"
            editable={!disabled}
            value={set.reps}
            maxLength={10}
            placeholder={guidance?.reps != null ? String(guidance.reps) : 'reps'}
            placeholderTextColor={p['ink-muted']}
            style={[...fieldStyle, { textAlign: 'center' }]}
            onChangeText={(reps) => onChange({ ...set, reps })}
          />
          <Text style={{ color: p['ink-muted'], textAlign: 'center' }}>reps</Text>
        </View>
        {onConfirm ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${saved ? 'Unsave' : 'Save'} ${label.toLowerCase()}`}
            accessibilityState={{ disabled, selected: saved }}
            disabled={disabled}
            onPress={onConfirm}
            style={{
              width: sizes['tap-min'],
              height: sizes['tap-min'],
              borderRadius: radii['radius-pill'],
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: saved ? p.brand : p['surface-300'],
              borderWidth: 1,
              borderColor: saved ? p.brand : p['line-strong'],
            }}
          >
            <Feather name="check" size={24} color={saved ? p['on-brand'] : p['ink-muted']} />
          </Pressable>
        ) : (
          <Button
            title="−"
            accessibilityLabel={label.replace(
              /^Exercise (\d+) set (\d+)$/,
              'Remove set $2 from exercise $1',
            )}
            secondary
            disabled={disabled}
            onPress={onRemove}
          />
        )}
      </View>
      {!weightValid ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          Enter nonnegative weight up to 999999.99 kg with at most {decimals} decimals.
        </Text>
      ) : null}
      {!validReps ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          Enter positive whole repetitions.
        </Text>
      ) : null}
    </View>
  );
}
