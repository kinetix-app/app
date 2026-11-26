import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLanguage } from '@/i18n/Language';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { Button, ui } from '@/features/training/components/ui';
import { FormCheckScreen } from './FormCheckScreen';

export function AnalyzingScreen({ onCancel }: Readonly<{ onCancel: () => void }>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <FormCheckScreen
      backIcon="x"
      backLabel={es ? 'Cancelar análisis' : 'Cancel analysis'}
      onBack={onCancel}
      scroll={false}
      footer={<Button title={es ? 'Cancelar' : 'Cancel'} onPress={onCancel} secondary />}
    >
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={es ? 'Analizando tu serie' : 'Analyzing your set'}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing['space-4'] }}
      >
        <ActivityIndicator size="large" color={p.brand} />
        <Text style={[textStyles['title-md'], { color: p.ink }]}>
          {es ? 'Analizando tu serie…' : 'Analyzing your set…'}
        </Text>
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {es ? 'Esto permanece en tu teléfono.' : 'This stays on your phone.'}
        </Text>
      </View>
    </FormCheckScreen>
  );
}

/** The analysis itself failed, which is different from a recording that cannot be assessed. */
export function AnalysisFailedScreen({
  onRetry,
  onRecordAgain,
  onClose,
}: Readonly<{
  onRetry: () => void;
  onRecordAgain: () => void;
  onClose: () => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <FormCheckScreen
      backIcon="x"
      backLabel={es ? 'Volver al entrenamiento' : 'Back to workout'}
      onBack={onClose}
      footer={
        <>
          <Button title={es ? 'Reintentar' : 'Try again'} onPress={onRetry} />
          <Button
            title={es ? 'Grabar de nuevo' : 'Record again'}
            onPress={onRecordAgain}
            secondary
          />
          <Button
            title={es ? 'Registrar serie manualmente' : 'Log set by hand'}
            onPress={onClose}
            secondary
          />
        </>
      }
    >
      <View style={ui.gap}>
        <Text accessibilityRole="header" style={[textStyles['display-lg'], { color: p.ink }]}>
          {es ? 'Algo ha salido mal' : 'Something went wrong'}
        </Text>
        <Text accessibilityRole="alert" style={[textStyles.body, { color: p['ink-muted'] }]}>
          {es
            ? 'No se pudo analizar esta grabación. El vídeo sigue en tu teléfono, así que puedes intentarlo de nuevo.'
            : 'We could not analyze this recording. Your video is still on your phone, so you can try again.'}
        </Text>
      </View>
    </FormCheckScreen>
  );
}
