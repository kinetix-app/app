import { getTranslation } from '@/i18n/catalog';
import React, { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '@/i18n/Language';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { apiClient } from '@/services/apiClient';
import { usePalette } from '@/theme/tokens';
import { updateProfile } from '../api';
import { profileDefaults, type ProfileFormValues } from '../profileForm';
import type { Account } from '../schemas';
import { ActivityFields } from './ProfileEditor';
import { ProfileBack } from './ProfileBack';
import { SetupButton, setupStyles as s } from './SetupUI';

export function ActivityEditor({
  account,
  onSaved,
  onCancel,
  active = true,
}: Readonly<{
  account: Account;
  onSaved: (account: Account) => void;
  onCancel: () => void;
  active?: boolean;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const form = useForm<ProfileFormValues>({ defaultValues: profileDefaults(account) });
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState('');
  const busy = useRef(false);
  useHardwareBack(() => {
    if (!busy.current) onCancel();
    return true;
  }, active);
  async function save() {
    if (busy.current) return;
    const activity = form.getValues('activity_level');
    if (!activity) {
      form.setError('activity_level', { message: 'Choose your usual activity level.' });
      return;
    }
    busy.current = true;
    setPending(true);
    setFailure('');
    try {
      const updated = await updateProfile(apiClient, { activity_level: activity });
      onSaved(updated);
    } catch {
      setFailure(
        getTranslation(es ? 'es' : 'en')(
          'accountsUi.could_not_save_your_activity_please_try_again',
        ),
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[s.screen, { backgroundColor: p['surface-100'] }]}
    >
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader
          title={getTranslation(es ? 'es' : 'en')('accountsUi.usual_activity')}
          leading={
            <ProfileBack
              onPress={() => {
                if (!pending) onCancel();
              }}
              label={getTranslation(es ? 'es' : 'en')('accountsUi.back_to_profile')}
            />
          }
        />
        <ActivityFields
          form={form}
          disabled={pending}
          error={form.formState.errors.activity_level?.message}
        />
        {failure ? (
          <Text accessibilityRole="alert" style={{ color: p.danger }}>
            {failure}
          </Text>
        ) : null}
        <SetupButton
          title={
            pending
              ? getTranslation(es ? 'es' : 'en')('accountsUi.saving')
              : getTranslation(es ? 'es' : 'en')('accountsUi.save_activity')
          }
          disabled={pending}
          onPress={() => {
            void save();
          }}
        />
        <SetupButton
          title={getTranslation(es ? 'es' : 'en')('accountsUi.cancel')}
          secondary
          disabled={pending}
          onPress={onCancel}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
