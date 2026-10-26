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
  onOverlay = false,
}: Readonly<{
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  onOverlay?: boolean;
}>) {
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
        backgroundColor: onOverlay ? p.brand : p['surface-300'],
        opacity: disabled || pressed ? 0.55 : 1,
      })}
    >
      <Feather name={icon} size={24} color={onOverlay ? p['on-brand'] : p.ink} />
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
}: Readonly<{
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  accessibilityLabel?: string;
  tone?: 'positive' | 'danger';
  icon?: React.ComponentProps<typeof Feather>['name'];
}>) {
  const p = usePalette();
  const background = buttonBackground(tone, secondary, p);
  const foreground = buttonForeground(tone, secondary, p);
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
function buttonBackground(
  tone: 'positive' | 'danger' | undefined,
  secondary: boolean | undefined,
  palette: ReturnType<typeof usePalette>,
) {
  if (tone === 'danger' || secondary) return palette['surface-300'];
  if (tone === 'positive') return palette['brand-soft'];
  return palette.brand;
}

function buttonForeground(
  tone: 'positive' | 'danger' | undefined,
  secondary: boolean | undefined,
  palette: ReturnType<typeof usePalette>,
) {
  if (tone === 'danger') return palette.danger;
  if (tone === 'positive') return palette['brand-ink'];
  return secondary ? palette.ink : palette['on-brand'];
}

export function Failure({ error, retry }: Readonly<{ error: unknown; retry?: () => void }>) {
  const p = usePalette();
  const text = getFailureMessage(error);
  return (
    <View style={ui.gap}>
      <Text accessibilityRole="alert" style={{ color: p.danger }}>
        {text}
      </Text>
      {retry ? <Button title="Retry" onPress={retry} secondary /> : null}
    </View>
  );
}

function getFailureMessage(error: unknown) {
  if (!(error instanceof ApiError))
    return 'Could not connect or read the response. Your changes are still here. Try again.';
  if ([401, 403].includes(error.status))
    return 'Your account cannot access this data. Sign out and sign in again.';
  if (error.status === 404) return 'This routine or exercise is no longer available.';
  if (error.status === 422)
    return 'Some fields or exercises are unavailable. Check your selection and try again.';
  return 'Could not connect or read the response. Your changes are still here. Try again.';
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
});
