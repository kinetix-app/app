import React from 'react';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { ApiError } from '@/services/apiClient';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

export { Button };

export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  onOverlay = false,
  bare = false,
}: Readonly<{
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  onOverlay?: boolean;
  bare?: boolean;
}>) {
  const p = usePalette();
  let background = onOverlay ? p.brand : p['surface-300'];
  let foreground = onOverlay ? p['on-brand'] : p.ink;
  if (bare) {
    background = 'transparent';
    foreground = p.brand;
  }
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
        backgroundColor: background,
        borderWidth: 0,
        opacity: disabled || pressed ? 0.55 : 1,
      })}
    >
      <Feather name={icon} size={24} color={foreground} />
    </Pressable>
  );
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
