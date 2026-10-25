import React, { useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { apiClient } from '@/services/apiClient';
import { textStyles, usePalette } from '@/theme/tokens';
import { updateProfile } from '../api';
import type { Account } from '../schemas';
import {
  canonicalWeight,
  profileDefaults,
  profileFormSchema,
  type ProfileFormValues,
} from '../profileForm';
import { SetupButton, setupStyles as s } from './SetupUI';

const fields = [
  ['display_name', 'Name'],
  ['age', 'Age (years)'],
  ['height_cm', 'Height (cm)'],
  ['weight', 'Weight'],
  ['picture_url', 'Profile picture URL (optional)'],
] as const;
export function ProfileEditor({
  account,
  onSaved,
  onCancel,
  onSignOut,
}: {
  account: Account;
  onSaved: (account: Account) => void;
  onCancel?: () => void;
  onSignOut?: () => void;
}) {
  const p = usePalette();
  const defaults = profileDefaults(account);
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormValues>({ defaultValues: defaults });
  const unit = useWatch({ control, name: 'weight_unit' });
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState('');
  const busy = useRef(false);
  async function save() {
    await handleSubmit(async (raw) => {
      if (busy.current) return;
      clearErrors();
      const parsed = profileFormSchema.safeParse(raw);
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) =>
          setError(issue.path[0] as keyof ProfileFormValues, { message: issue.message }),
        );
        return;
      }
      const value = parsed.data;
      if (!value.weight_unit) return;
      busy.current = true;
      setPending(true);
      setFailure('');
      try {
        const result = await updateProfile(apiClient, {
          display_name: value.display_name,
          age: Number(value.age),
          height_cm: value.height_cm,
          weight_kg:
            value.weight === defaults.weight && value.weight_unit === defaults.weight_unit
              ? account.profile.weight_kg
              : canonicalWeight(value.weight, value.weight_unit),
          weight_unit: value.weight_unit,
          picture_url: value.picture_url || null,
        });
        onSaved(result);
      } catch {
        setFailure('Could not save your profile. Your entries are kept. Try again.');
      } finally {
        busy.current = false;
        setPending(false);
      }
    })();
  }
  return (
    <SafeAreaView
      style={[s.screen, { backgroundColor: p['surface-100'] }]}
      edges={onCancel ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={s.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
          <ScreenHeader title={onCancel ? 'Edit profile' : 'Your profile'} />
          <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
            Tell us about yourself. Your picture is optional. Choose the weight unit you prefer.
          </Text>
          <View style={[s.card, { backgroundColor: p['surface-200'] }]}>
            {fields.map(([name, label]) => (
              <View key={name} style={{ gap: 8 }}>
                <Text style={[textStyles.label, { color: p.ink }]}>
                  {name === 'weight' && unit ? `Weight (${unit})` : label}
                </Text>
                <Controller
                  control={control}
                  name={name}
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      accessibilityLabel={label}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      editable={!pending}
                      autoCapitalize={name === 'display_name' ? 'words' : 'none'}
                      autoCorrect={false}
                      keyboardType={
                        name === 'display_name'
                          ? 'default'
                          : name === 'picture_url'
                            ? 'url'
                            : 'decimal-pad'
                      }
                      style={[
                        s.field,
                        textStyles.body,
                        {
                          color: p.ink,
                          backgroundColor: p['surface-300'],
                          borderColor: errors[name] ? p.danger : p['line-strong'],
                        },
                      ]}
                    />
                  )}
                />
                {errors[name] ? (
                  <Text accessibilityRole="alert" style={{ color: p.danger }}>
                    {errors[name]?.message}
                  </Text>
                ) : null}
              </View>
            ))}
            <Text style={[textStyles.label, { color: p.ink }]}>Weight unit</Text>
            <Controller
              control={control}
              name="weight_unit"
              render={({ field: { value, onChange } }) => (
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Weight unit"
                  style={{ flexDirection: 'row', gap: 12 }}
                >
                  {(['kg', 'lb'] as const).map((unit) => (
                    <Pressable
                      key={unit}
                      accessibilityRole="radio"
                      accessibilityLabel={unit}
                      accessibilityState={{
                        selected: value === unit,
                        checked: value === unit,
                        disabled: pending,
                      }}
                      disabled={pending}
                      onPress={() => {
                        const weight = getValues('weight');
                        if (value && value !== unit && /^\d+(?:\.\d{1,6})?$/.test(weight)) {
                          const kg = canonicalWeight(weight, value);
                          setValue(
                            'weight',
                            unit === 'kg' ? kg : (Number(kg) / 0.45359237).toFixed(6),
                          );
                        }
                        onChange(unit);
                      }}
                      style={[
                        s.field,
                        {
                          flex: 1,
                          borderColor: value === unit ? p.brand : p['line-strong'],
                          backgroundColor: value === unit ? p['brand-soft'] : p['surface-300'],
                        },
                      ]}
                    >
                      <Text style={{ color: value === unit ? p['brand-ink'] : p.ink }}>
                        {unit}
                        {value === unit ? ' ✓' : ''}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            />
            {errors.weight_unit ? (
              <Text accessibilityRole="alert" style={{ color: p.danger }}>
                {errors.weight_unit.message}
              </Text>
            ) : null}
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              Switching units converts the entered weight. Height is in centimetres. For a picture,
              enter an HTTPS image URL or leave it empty.
            </Text>
          </View>
          {failure ? (
            <Text accessibilityRole="alert" style={{ color: p.danger }}>
              {failure}
            </Text>
          ) : null}
          <SetupButton
            title={pending ? 'Saving…' : 'Save profile'}
            disabled={pending}
            onPress={() => {
              void save();
            }}
          />
          {onCancel ? (
            <SetupButton title="Cancel" secondary disabled={pending} onPress={onCancel} />
          ) : null}
          {onSignOut ? (
            <SetupButton title="Sign out" secondary disabled={pending} onPress={onSignOut} />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
