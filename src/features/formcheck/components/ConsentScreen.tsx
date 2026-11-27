import { getTranslation } from '@/i18n/catalog';
import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLanguage } from '@/i18n/Language';
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
  const language = useLanguage();
  return (
    <FormCheckScreen
      onBack={onClose}
      backLabel={getTranslation(language)('formcheck.ConsentScreen.backToWorkout')}
      footer={
        <>
          {denied ? (
            <Button
              title={getTranslation(language)('formcheck.ConsentScreen.openSettings')}
              onPress={onOpenSettings}
            />
          ) : (
            <Button
              title={getTranslation(language)('formcheck.ConsentScreen.allowCamera')}
              onPress={onAllow}
            />
          )}
          <Button
            title={getTranslation(language)('formcheck.ConsentScreen.notNow')}
            onPress={onClose}
            secondary
          />
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
          {getTranslation(language)('formcheck.ConsentScreen.checkYourForm')}
        </Text>
        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
          {getTranslation(language)(
            'formcheck.ConsentScreen.recordASetAndKinetixCountsYourRepsAndPointsOutTheMainThingToImpro',
          )}
        </Text>
      </View>
      {denied ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          {getTranslation(language)(
            'formcheck.ConsentScreen.cameraAccessIsTurnedOffTurnItOnInYourPhoneSettingsToRecordASet',
          )}
        </Text>
      ) : null}
      <View style={[ui.card, { backgroundColor: p['surface-200'], gap: spacing['space-4'] }]}>
        <Point
          icon="smartphone"
          title={getTranslation(language)('formcheck.ConsentScreen.analyzedOnYourPhone')}
          text={getTranslation(language)('formcheck.ConsentScreen.yourVideoIsNotUploaded')}
        />
        <Point
          icon="trash-2"
          title={getTranslation(language)('formcheck.ConsentScreen.deletedWhenYouFinish')}
          text={getTranslation(language)(
            'formcheck.ConsentScreen.theVideoIsRemovedWhenYouFinishOrDiscardTheWorkoutRepsAndFormNotes',
          )}
        />
        <Point
          icon="target"
          title={getTranslation(language)('formcheck.ConsentScreen.aTrainingAid')}
          text={getTranslation(language)('formcheck.ConsentScreen.notMedicalAdvice')}
        />
      </View>
      {supportedNames.length ? (
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {getTranslation(language)('formcheck.ConsentScreen.availableFor')}{' '}
          {supportedNames.join(', ')}.{' '}
          {getTranslation(language)('formcheck.ConsentScreen.moreExercisesComing')}
        </Text>
      ) : null}
    </FormCheckScreen>
  );
}
