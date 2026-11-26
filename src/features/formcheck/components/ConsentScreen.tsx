import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { selectCopy, useLanguage } from '@/i18n/Language';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { Button, ui } from '@/features/training/components/ui';
import { FormCheckScreen } from './FormCheckScreen';

type IconName = React.ComponentProps<typeof Feather>['name'];

function Point({ icon, title, text }: Readonly<{ icon: IconName; title: string; text: string }>) {
  const p = usePalette();
  return (
    <View style={[ui.row, { alignItems: 'flex-start' }]}>
      <Feather name={icon} size={20} color={p['brand-ink']} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={[textStyles.label, { color: p.ink }]}>{title}</Text>
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{text}</Text>
      </View>
    </View>
  );
}

/** Shown before the camera is available: what the feature does and how the video is handled. */
export function ConsentScreen({
  supportedNames,
  denied,
  onAllow,
  onOpenSettings,
  onClose,
}: Readonly<{
  supportedNames: string[];
  /** The user refused the camera and the system will not ask again. */
  denied: boolean;
  onAllow: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <FormCheckScreen
      onBack={onClose}
      backLabel={selectCopy(es, 'Volver al entrenamiento', 'Back to workout')}
      footer={
        <>
          {denied ? (
            <Button
              title={selectCopy(es, 'Abrir ajustes', 'Open settings')}
              onPress={onOpenSettings}
            />
          ) : (
            <Button title={selectCopy(es, 'Permitir cámara', 'Allow camera')} onPress={onAllow} />
          )}
          <Button title={selectCopy(es, 'Ahora no', 'Not now')} onPress={onClose} secondary />
        </>
      }
    >
      <View style={ui.gap}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radii['radius-pill'],
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: p['brand-soft'],
          }}
        >
          <Feather name="camera" size={32} color={p['brand-ink']} />
        </View>
        <Text accessibilityRole="header" style={[textStyles['display-lg'], { color: p.ink }]}>
          {selectCopy(es, 'Revisa tu técnica', 'Check your form')}
        </Text>
        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
          {selectCopy(
            es,
            'Graba una serie y Kinetix contará tus repeticiones y señalará lo principal que puedes mejorar.',
            'Record a set and Kinetix counts your reps and points out the main thing to improve.',
          )}
        </Text>
      </View>
      {denied ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          {selectCopy(
            es,
            'El acceso a la cámara está desactivado. Actívalo en los ajustes del teléfono para grabar una serie.',
            'Camera access is turned off. Turn it on in your phone settings to record a set.',
          )}
        </Text>
      ) : null}
      <View style={[ui.card, { backgroundColor: p['surface-200'], gap: spacing['space-4'] }]}>
        <Point
          icon="smartphone"
          title={selectCopy(es, 'Analizado en tu teléfono', 'Analyzed on your phone')}
          text={selectCopy(es, 'Tu vídeo no se sube.', 'Your video is not uploaded.')}
        />
        <Point
          icon="trash-2"
          title={selectCopy(es, 'Se elimina al terminar', 'Deleted when you finish')}
          text={selectCopy(
            es,
            'El vídeo se elimina al terminar o descartar el entrenamiento. Las repeticiones y notas permanecen en la serie.',
            'The video is removed when you finish or discard the workout. Reps and form notes stay with the set.',
          )}
        />
        <Point
          icon="target"
          title={selectCopy(es, 'Una ayuda para entrenar', 'A training aid')}
          text={selectCopy(es, 'No es asesoramiento médico.', 'Not medical advice.')}
        />
      </View>
      {supportedNames.length ? (
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {selectCopy(es, 'Disponible para', 'Available for')} {supportedNames.join(', ')}.{' '}
          {selectCopy(es, 'Pronto habrá más ejercicios.', 'More exercises coming.')}
        </Text>
      ) : null}
    </FormCheckScreen>
  );
}
