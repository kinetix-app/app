import React from 'react';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { useLanguage, type Language } from '@/i18n/Language';
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
  expanded,
  busy,
}: Readonly<{
  icon: React.ComponentProps<typeof Feather>['name'] | React.ReactElement;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  onOverlay?: boolean;
  bare?: boolean;
  expanded?: boolean;
  busy?: boolean;
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
      accessibilityState={{ disabled, expanded, busy }}
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
      {typeof icon === 'string' ? <Feather name={icon} size={24} color={foreground} /> : icon}
    </Pressable>
  );
}

export function Failure({ error, retry }: Readonly<{ error: unknown; retry?: () => void }>) {
  const p = usePalette();
  const language = useLanguage();
  const text = getFailureMessage(error, language);
  return (
    <View style={ui.gap}>
      <Text accessibilityRole="alert" style={{ color: p.danger }}>
        {text}
      </Text>
      {retry ? (
        <Button title={language === 'es' ? 'Reintentar' : 'Retry'} onPress={retry} secondary />
      ) : null}
    </View>
  );
}

function getFailureMessage(error: unknown, language: Language) {
  const es = language === 'es';
  const connectionError = es
    ? 'No se pudo conectar o leer la respuesta. Se han conservado tus cambios. Inténtalo de nuevo.'
    : 'Could not connect or read the response. Your changes are still here. Try again.';
  if (!(error instanceof ApiError)) return connectionError;
  if ([401, 403].includes(error.status))
    return es
      ? 'Tu cuenta no puede acceder a estos datos. Cierra sesión y vuelve a iniciarla.'
      : 'Your account cannot access this data. Sign out and sign in again.';
  if (error.status === 404)
    return es
      ? 'Esta rutina o ejercicio ya no está disponible.'
      : 'This routine or exercise is no longer available.';
  if (error.status === 422)
    return es
      ? 'Algunos campos o ejercicios no están disponibles. Comprueba la selección e inténtalo de nuevo.'
      : 'Some fields or exercises are unavailable. Check your selection and try again.';
  return connectionError;
}

export function Loading() {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <ActivityIndicator
      color={p.brand}
      accessibilityLabel={es ? 'Cargando entrenamiento' : 'Loading training'}
    />
  );
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
