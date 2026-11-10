import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { TextField } from '@/components/TextField';
import { radii, spacing, sizes, usePalette } from '@/theme/tokens';
import type { ActualSet } from '../sessionDraft';
import { displayWeight } from '../sessionDraft';
import { validWeight, type WeightUnit } from '../schemas';
import { ActionMenu } from './ActionMenu';
import { ui } from './ui';

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
  cardio = false,
}: Readonly<{
  cardio?: boolean;
  set: ActualSet;
  unit: WeightUnit;
  label: string;
  disabled: boolean;
  decimals?: number;
  number?: number;
  onConfirm?: () => void;
  saved?: boolean;
  guidance?: {
    reps: number | null;
    weightKg: string | null;
    durationSeconds?: number | null;
    distanceKm?: string | null;
  };
  onChange: (set: ActualSet) => void;
  onRemove: () => void;
}>) {
  const p = usePalette();
  const weightValid = isValidWeight(set, decimals);
  const validReps = isValidReps(set.reps);
  return (
    <View style={ui.gap}>
      <View
        style={[
          ui.row,
          {
            padding: spacing['space-3'],
            borderRadius: radii['radius-md'],
            backgroundColor: saved ? p['brand-soft'] : p['surface-200'],
            borderWidth: saved ? 0 : 1,
            borderColor: p['line-strong'],
          },
        ]}
      >
        <SetPosition number={number} label={label} disabled={disabled} onRemove={onRemove} />
        {cardio ? (
          <CardioInputs set={set} label={label} disabled={disabled} onChange={onChange} />
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <TextField
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
                inputStyle={{ textAlign: 'center' }}
                onChangeText={(value) => onChange({ ...set, value, unit })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                accessibilityLabel={`${label} reps`}
                keyboardType="number-pad"
                editable={!disabled}
                value={set.reps}
                maxLength={10}
                placeholder={guidance?.reps != null ? String(guidance.reps) : 'reps'}
                inputStyle={{ textAlign: 'center' }}
                onChangeText={(reps) => onChange({ ...set, reps })}
              />
            </View>
          </>
        )}
        <SetAction onConfirm={onConfirm} disabled={disabled} saved={saved} label={label} />
      </View>
      {cardio ? <CardioGuidance set={set} guidance={guidance} /> : null}
      {!cardio && !weightValid ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          Enter positive weight up to 999999.99 kg with at most {decimals} decimals.
        </Text>
      ) : null}
      {!cardio && !validReps ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          Enter positive whole repetitions.
        </Text>
      ) : null}
    </View>
  );
}

type CardioFieldProps = Readonly<{
  set: ActualSet;
  label: string;
  disabled: boolean;
  onChange: (set: ActualSet) => void;
}>;
const CARDIO_PLACEHOLDERS = { distance: 'km', hours: 'h', minutes: 'min', seconds: 'sec' } as const;
function CardioInputs({ set, label, disabled, onChange }: CardioFieldProps) {
  return (Object.keys(CARDIO_PLACEHOLDERS) as (keyof typeof CARDIO_PLACEHOLDERS)[]).map((key) => (
    <View key={key} style={{ flex: 1 }}>
      <TextField
        accessibilityLabel={`${label} ${key}`}
        keyboardType={key === 'distance' ? 'decimal-pad' : 'number-pad'}
        editable={!disabled}
        value={set[key] ?? ''}
        placeholder={CARDIO_PLACEHOLDERS[key]}
        onChangeText={(value) => onChange({ ...set, [key]: value })}
      />
    </View>
  ));
}
function CardioGuidance({
  set,
  guidance,
}: Readonly<{
  set: ActualSet;
  guidance?: {
    reps: number | null;
    weightKg: string | null;
    durationSeconds?: number | null;
    distanceKm?: string | null;
  };
}>) {
  const p = usePalette();
  let previous = null;
  if (guidance && (guidance.reps !== null || guidance.weightKg !== null))
    previous = `Previous result: ${guidance.weightKg ?? '—'} kg · ${guidance.reps ?? '—'} reps`;
  else if (guidance?.durationSeconds != null && guidance.distanceKm != null)
    previous = `Previous result: ${guidance.distanceKm} km · ${guidance.durationSeconds} seconds`;
  return (
    <>
      {set.reps || set.value ? (
        <Text style={{ color: p['ink-muted'] }}>
          Previous entry: {set.value || '—'} {set.unit} · {set.reps || '—'} reps. Enter distance and
          time to replace it.
        </Text>
      ) : null}
      {previous ? <Text style={{ color: p['ink-muted'] }}>{previous}</Text> : null}
    </>
  );
}

function isValidWeight(set: ActualSet, decimals: number) {
  return !set.value || validWeight(set.value, set.unit, decimals);
}

function isValidReps(reps: string) {
  return !reps || (/^\d+$/.test(reps) && Number(reps) >= 1 && Number(reps) <= 2147483647);
}

function SetPosition({
  number,
  label,
  disabled,
  onRemove,
}: Readonly<{
  number?: number;
  label: string;
  disabled: boolean;
  onRemove: () => void;
}>) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  if (!number) return null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Actions for ${label.toLowerCase()}`}
        accessibilityHint="Open set actions"
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{
          width: 44,
          minHeight: 44,
          borderRadius: radii['radius-sm'],
          backgroundColor: p['surface-300'],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: p.ink }}>{number}</Text>
      </Pressable>
      {open ? (
        <ActionMenu
          title={`Set ${number}`}
          onClose={() => setOpen(false)}
          actions={[{ title: 'Remove set', onPress: onRemove }]}
        />
      ) : null}
    </>
  );
}

export function SetColumnHeaders({ confirmation = false }: Readonly<{ confirmation?: boolean }>) {
  const p = usePalette();
  return (
    <View style={[ui.row, { paddingHorizontal: spacing['space-3'] }]}>
      <Text style={{ width: 44, textAlign: 'center', color: p['ink-muted'] }}>Set</Text>
      <Text style={{ flex: 1, textAlign: 'center', color: p['ink-muted'] }}>kg</Text>
      <Text style={{ flex: 1, textAlign: 'center', color: p['ink-muted'] }}>Reps</Text>
      {confirmation ? <View style={{ width: sizes['tap-min'] }} /> : null}
    </View>
  );
}

function SetAction({
  onConfirm,
  disabled,
  saved,
  label,
}: Readonly<{
  onConfirm?: () => void;
  disabled: boolean;
  saved: boolean;
  label: string;
}>) {
  const p = usePalette();
  if (!onConfirm) return null;
  return (
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
  );
}
