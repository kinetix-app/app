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
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { apiClient } from '@/services/apiClient';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { updateProfile } from '../api';
import type { Account } from '../schemas';
import {
  canonicalWeight,
  profileDefaults,
  profileFormSchema,
  type ProfileFormValues,
} from '../profileForm';
import { SetupButton, setupStyles as s } from './SetupUI';
import { ProfilePictureEditor } from './ProfilePictureEditor';
import { ProfileAvatar } from './ProfileAvatar';

const fields = [
  ['display_name', 'Name'],
  ['age', 'Age (years)'],
  ['height_cm', 'Height (cm)'],
  ['weight', 'Weight'],
] as const;
export function ProfileEditor({
  account,
  onSaved,
  onCancel,
  onSignOut,
  onPhotoSaved,
}: {
  account: Account;
  onSaved: (account: Account) => void;
  onCancel?: () => void;
  onSignOut?: () => void;
  onPhotoSaved?: (account: Account) => void;
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
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoAccount, setPhotoAccount] = useState(account);
  const [step, setStep] = useState(0);
  const steps = ['About you', 'Your age', 'Your measurements', 'Ready to go?'];
  const disabled = pending || photoBusy;
  const currentFields =
    step === 0 ? ['display_name'] : step === 1 ? ['age'] : ['weight_unit', 'weight', 'height_cm'];
  function advance() {
    clearErrors();
    const parsed = profileFormSchema.safeParse(getValues());
    const issues = parsed.success
      ? []
      : parsed.error.issues.filter((issue) => currentFields.includes(String(issue.path[0])));
    issues.forEach((issue) =>
      setError(issue.path[0] as keyof ProfileFormValues, { message: issue.message }),
    );
    if (!issues.length) setStep((value) => value + 1);
  }
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
          <ScreenHeader
            leading={
              step > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  onPress={() => setStep((value) => value - 1)}
                  style={[wizard.back, { backgroundColor: p['surface-300'] }]}
                >
                  <Text style={{ color: p.ink, fontSize: 24 }}>←</Text>
                </Pressable>
              ) : undefined
            }
            title={onCancel ? 'Edit profile' : 'Your profile'}
          />
          <View style={{ gap: spacing['space-2'] }}>
            <Text
              accessibilityLiveRegion="polite"
              style={[textStyles.label, { color: p['ink-muted'] }]}
            >
              Step {step + 1} of 4 · {steps[step]}
            </Text>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Profile setup progress"
              accessibilityValue={{ min: 1, max: 4, now: step + 1 }}
              style={wizard.progress}
            >
              {steps.map((label, index) => (
                <View
                  key={label}
                  style={[
                    wizard.segment,
                    { backgroundColor: index <= step ? p.brand : p['surface-300'] },
                  ]}
                />
              ))}
            </View>
          </View>
          <View style={{ gap: spacing['space-2'] }}>
            <Text accessibilityRole="header" style={[textStyles['title-lg'], { color: p.ink }]}>
              {steps[step]}
            </Text>
            <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
              {
                [
                  'Start with your name and an optional profile picture.',
                  'Add your age in years to complete your profile.',
                  'Choose your preferred weight unit, then add your measurements.',
                  'Take a moment to check your details before saving.',
                ][step]
              }
            </Text>
          </View>
          <View style={[s.card, { backgroundColor: p['surface-200'] }]}>
            <View style={step === 0 ? undefined : { display: 'none' }}>
              <ProfilePictureEditor
                account={photoAccount}
                onChanged={setPhotoAccount}
                onBusy={setPhotoBusy}
              />
            </View>
            {step === 2 ? (
              <>
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
                            disabled,
                          }}
                          disabled={disabled}
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
                  Switching units converts the entered weight. Height is in centimetres.
                </Text>
              </>
            ) : null}
            {fields
              .filter(([name]) =>
                step === 0
                  ? name === 'display_name'
                  : step === 1
                    ? name === 'age'
                    : step === 2
                      ? name === 'weight' || name === 'height_cm'
                      : false,
              )
              .map(([name, label]) => (
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
                        editable={!disabled}
                        autoCapitalize={name === 'display_name' ? 'words' : 'none'}
                        autoCorrect={false}
                        keyboardType={name === 'display_name' ? 'default' : 'decimal-pad'}
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
            {step === 3 ? (
              <>
                <ProfileAvatar account={photoAccount} />
                {[
                  ['Name', getValues('display_name')],
                  ['Age', `${getValues('age')} years`],
                  ['Height', `${getValues('height_cm')} cm`],
                  ['Weight', `${getValues('weight')} ${unit}`],
                ].map(([label, value]) => (
                  <View key={label} style={wizard.reviewRow}>
                    <Text style={[textStyles.body, { color: p['ink-muted'] }]}>{label}</Text>
                    <Text style={[textStyles.label, { color: p.ink, flexShrink: 1 }]}>{value}</Text>
                  </View>
                ))}
              </>
            ) : null}
          </View>
          {failure ? (
            <Text accessibilityRole="alert" style={{ color: p.danger }}>
              {failure}
            </Text>
          ) : null}
          <SetupButton
            title={pending ? 'Saving…' : step === 3 ? 'Save profile' : 'Continue'}
            disabled={disabled}
            onPress={() => {
              if (step === 3) void save();
              else advance();
            }}
          />
          {onCancel ? (
            <SetupButton
              title="Cancel"
              secondary
              disabled={disabled}
              onPress={() => {
                if (photoAccount !== account) onPhotoSaved?.(photoAccount);
                onCancel();
              }}
            />
          ) : null}
          {onSignOut ? (
            <SetupButton title="Sign out" secondary disabled={disabled} onPress={onSignOut} />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const wizard = StyleSheet.create({
  back: {
    minWidth: sizes['tap-min'],
    minHeight: sizes['tap-min'],
    borderRadius: radii['radius-pill'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: { flexDirection: 'row', gap: spacing['space-2'] },
  segment: { flex: 1, height: spacing['space-1'], borderRadius: radii['radius-pill'] },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing['space-4'],
    paddingVertical: spacing['space-2'],
  },
});
