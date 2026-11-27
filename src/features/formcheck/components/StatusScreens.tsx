import { getTranslation } from '@/i18n/catalog';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLanguage } from '@/i18n/Language';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { Button, ui } from '@/features/training/components/ui';
import { FormCheckScreen } from './FormCheckScreen';

export function AnalyzingScreen({ onCancel }: Readonly<{ onCancel: () => void }>) {
  const p = usePalette();
  const language = useLanguage();
  return (
    <FormCheckScreen
      backIcon="x"
      backLabel={getTranslation(language)('formcheck.StatusScreens.cancelAnalysis')}
      onBack={onCancel}
      scroll={false}
      footer={
        <Button
          title={getTranslation(language)('formcheck.StatusScreens.cancel')}
          onPress={onCancel}
          secondary
        />
      }
    >
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={getTranslation(language)('formcheck.StatusScreens.analyzingYourSet')}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing['space-4'] }}
      >
        <ActivityIndicator size="large" color={p.brand} />
        <Text style={[textStyles['title-md'], { color: p.ink }]}>
          {getTranslation(language)('formcheck.StatusScreens.analyzingYourSet2')}
        </Text>
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {getTranslation(language)('formcheck.StatusScreens.thisStaysOnYourPhone')}
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
  const language = useLanguage();
  return (
    <FormCheckScreen
      backIcon="x"
      backLabel={getTranslation(language)('formcheck.StatusScreens.backToWorkout')}
      onBack={onClose}
      footer={
        <>
          <Button
            title={getTranslation(language)('formcheck.StatusScreens.tryAgain')}
            onPress={onRetry}
          />
          <Button
            title={getTranslation(language)('formcheck.StatusScreens.recordAgain')}
            onPress={onRecordAgain}
            secondary
          />
          <Button
            title={getTranslation(language)('formcheck.StatusScreens.logSetByHand')}
            onPress={onClose}
            secondary
          />
        </>
      }
    >
      <View style={ui.gap}>
        <Text accessibilityRole="header" style={[textStyles['display-lg'], { color: p.ink }]}>
          {getTranslation(language)('formcheck.StatusScreens.somethingWentWrong')}
        </Text>
        <Text accessibilityRole="alert" style={[textStyles.body, { color: p['ink-muted'] }]}>
          {getTranslation(language)(
            'formcheck.StatusScreens.weCouldNotAnalyzeThisRecordingYourVideoIsStillOnYourPhoneSoYouCan',
          )}
        </Text>
      </View>
    </FormCheckScreen>
  );
}
