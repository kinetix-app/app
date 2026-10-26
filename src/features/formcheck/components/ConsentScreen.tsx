import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
  return (
    <FormCheckScreen
      onBack={onClose}
      backLabel="Back to workout"
      footer={
        <>
          {denied ? (
            <Button title="Open settings" onPress={onOpenSettings} />
          ) : (
            <Button title="Allow camera" onPress={onAllow} />
          )}
          <Button title="Not now" onPress={onClose} secondary />
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
          Check your form
        </Text>
        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
          Record a set and Kinetix counts your reps and points out the main thing to improve.
        </Text>
      </View>
      {denied ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          Camera access is turned off. Turn it on in your phone settings to record a set.
        </Text>
      ) : null}
      <View style={[ui.card, { backgroundColor: p['surface-200'], gap: spacing['space-4'] }]}>
        <Point
          icon="smartphone"
          title="Analyzed on your phone"
          text="Your video is not uploaded."
        />
        <Point
          icon="trash-2"
          title="Deleted when you finish"
          text="The video is removed when you finish or discard the workout. Reps and form notes stay with the set."
        />
        <Point icon="target" title="A training aid" text="Not medical advice." />
      </View>
      {supportedNames.length ? (
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          Available for {supportedNames.join(', ')}. More exercises coming.
        </Text>
      ) : null}
    </FormCheckScreen>
  );
}
