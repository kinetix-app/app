import React from 'react';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/services/apiClient';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  onPrimary = false,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  onPrimary?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: sizes['tap-min'],
        height: sizes['tap-min'],
        borderRadius: radii['radius-pill'],
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: onPrimary ? p['on-brand'] : p['surface-300'],
        opacity: disabled || pressed ? 0.55 : 1,
      })}
    >
      <Feather name={icon} size={24} color={onPrimary ? p.brand : p.ink} />
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
  accessibilityLabel,
  tone,
  icon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  accessibilityLabel?: string;
  tone?: 'positive' | 'danger';
  icon?: React.ComponentProps<typeof Feather>['name'];
}) {
  const p = usePalette();
  const background =
    tone === 'danger'
      ? p['surface-300']
      : tone === 'positive'
        ? p['brand-soft']
        : secondary
          ? p['surface-300']
          : p.brand;
  const foreground =
    tone === 'danger'
      ? p.danger
      : tone === 'positive'
        ? p['brand-ink']
        : secondary
          ? p.ink
          : p['on-brand'];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: spacing['space-2'],
        minHeight: sizes['control-height'],
        paddingHorizontal: spacing['space-5'],
        paddingVertical: spacing['space-3'],
        borderRadius: radii['radius-pill'],
        backgroundColor: background,
        borderWidth: tone === 'danger' ? 1 : 0,
        borderColor: tone === 'danger' ? p.danger : background,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled || pressed ? 0.55 : 1,
      })}
    >
      {icon ? <Feather name={icon} size={18} color={foreground} /> : null}
      <Text style={{ color: foreground, fontSize: 14, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}
export function Failure({ error, retry }: { error: unknown; retry?: () => void }) {
  const p = usePalette();
  const text =
    error instanceof ApiError && [401, 403].includes(error.status)
      ? 'Your account cannot access this data. Sign out and sign in again.'
      : error instanceof ApiError && error.status === 404
        ? 'This routine or exercise is no longer available.'
        : error instanceof ApiError && error.status === 422
          ? 'Some fields or exercises are unavailable. Check your selection and try again.'
          : 'Could not connect or read the response. Your changes are still here. Try again.';
  return (
    <View style={ui.gap}>
      <Text accessibilityRole="alert" style={{ color: p.danger }}>
        {text}
      </Text>
      {retry ? <Button title="Retry" onPress={retry} secondary /> : null}
    </View>
  );
}
export function Loading() {
  const p = usePalette();
  return <ActivityIndicator color={p.brand} accessibilityLabel="Loading training" />;
}
export const ui = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    padding: spacing['space-4'],
    gap: spacing['space-5'],
    paddingBottom: spacing['space-10'],
  },
  title: textStyles['display-lg'],
  heading: textStyles['title-lg'],
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-3'] },
  gap: { gap: spacing['space-3'] },
  card: { borderRadius: radii['radius-lg'], padding: spacing['space-4'], gap: spacing['space-3'] },
  field: {
    borderWidth: 1,
    borderRadius: radii['radius-md'],
    minHeight: sizes['control-height'],
    padding: spacing['space-3'],
    ...textStyles.body,
  },
});
