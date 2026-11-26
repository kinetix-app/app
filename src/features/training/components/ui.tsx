import { getTranslation } from '@/i18n/catalog';
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
  const connectionError = getTranslation(es)('training.couldNotConnectOrReadTheResponse_9c6b90');
  if (!(error instanceof ApiError)) return connectionError;
  if ([401, 403].includes(error.status))
    return getTranslation(es)('training.yourAccountCannotAccessThisDataSign_9b133b');
  if (error.status === 404)
    return getTranslation(es)('training.thisRoutineOrExerciseIsNoLonger_871e69');
  if (error.status === 422)
    return getTranslation(es)('training.someFieldsOrExercisesAreUnavailableCheck_4fe74a');
  return connectionError;
}

export function Loading() {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <ActivityIndicator
      color={p.brand}
      accessibilityLabel={getTranslation(es)('training.loadingTraining_a32005')}
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
