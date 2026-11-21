import React, { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
}: {
  account: Account;
  onSaved: (account: Account) => void;
  onCancel: () => void;
  active?: boolean;
}) {
  const p = usePalette();
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
      setFailure('Could not save your activity. Please try again.');
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
          title="Usual activity"
          leading={
            <ProfileBack
              onPress={() => {
                if (!pending) onCancel();
              }}
              label="Back to profile"
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
          title={pending ? 'Saving…' : 'Save activity'}
          disabled={pending}
          onPress={() => {
            void save();
          }}
        />
        <SetupButton title="Cancel" secondary disabled={pending} onPress={onCancel} />
      </ScrollView>
    </SafeAreaView>
  );
}
