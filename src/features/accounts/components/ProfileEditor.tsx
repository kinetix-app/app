import React, { useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { apiClient } from '@/services/apiClient';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { removeProfilePicture, uploadProfilePicture, updateProfile } from '../api';
import type { Account } from '../schemas';
import {
  savedWeight,
  savedHeight,
  displayHeight,
  displayWeight,
  profileDefaults,
  profileFormSchema,
  type ProfileFormValues,
} from '../profileForm';
import { SetupButton, setupStyles as s } from './SetupUI';
import { ProfilePictureEditor, type ProfilePictureDraft } from './ProfilePictureEditor';
import { ProfileAvatar } from './ProfileAvatar';

const fields = [
  ['display_name', 'Name'],
  ['age', 'Age (years)'],
  ['height_cm', 'Height (cm)'],
  ['height_ft', 'Height (feet)'],
  ['height_in', 'Height (inches)'],
  ['weight', 'Weight'],
] as const;
export function ProfileEditor({
  account,
  onSaved,
  onCancel,
}: {
  account: Account;
  onSaved: (account: Account) => void;
  onCancel?: () => void;
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
  const unit = useWatch({ control, name: 'measurement_system' });
  const [pending, setPending] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoDraft, setPhotoDraft] = useState<ProfilePictureDraft>({ kind: 'keep' });
  const appliedPhoto = useRef<ProfilePictureDraft | undefined>(undefined);
  const [photoAccount, setPhotoAccount] = useState(account);
  const [step, setStep] = useState(0);
  const steps = ['About you', 'Personal information', 'Confirmation'];
  const disabled = pending || photoBusy;
  const currentFields =
    step === 0
      ? ['display_name']
      : ['age', 'measurement_system', 'weight', 'height_cm', 'height_ft', 'height_in'];
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
      if (!value.measurement_system) return;
      busy.current = true;
      setPending(true);
      setFailure('');
      try {
        if (appliedPhoto.current !== photoDraft) {
          if (photoDraft.kind === 'select') {
            const asset = photoDraft.asset;
            const form = new FormData();
            if (Platform.OS === 'web' && asset.file)
              form.append('file', asset.file, asset.fileName ?? 'profile.jpg');
            else
              form.append('file', {
                uri: asset.uri,
                name: asset.fileName ?? 'profile.jpg',
                type: asset.mimeType ?? 'image/jpeg',
              } as unknown as Blob);
            setPhotoAccount(await uploadProfilePicture(form));
          } else if (photoDraft.kind === 'remove') setPhotoAccount(await removeProfilePicture());
          appliedPhoto.current = photoDraft;
        }
        const result = await updateProfile(apiClient, {
          display_name: value.display_name,
          age: Number(value.age),
          height_cm: savedHeight(value, value.measurement_system, account.profile.height_cm),
          weight_kg: savedWeight(value.weight, value.measurement_system, account.profile.weight_kg),
          measurement_system: value.measurement_system,
        });
        onSaved(result);
      } catch {
        setFailure(
          'Could not save your profile. Your details and picture choice are kept. Try again.',
        );
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
              Step {step + 1} of 3 · {steps[step]}
            </Text>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Profile setup progress"
              accessibilityValue={{ min: 1, max: 3, now: step + 1 }}
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
                  'Add your age, choose your measurement system and enter your measurements.',
                  'Take a moment to check your details before saving.',
                ][step]
              }
            </Text>
          </View>
          <View style={[s.card, { backgroundColor: p['surface-200'] }]}>
            <View style={step === 0 ? undefined : { display: 'none' }}>
              <ProfilePictureEditor
                account={photoAccount}
                draft={photoDraft}
                onDraftChange={setPhotoDraft}
                disabled={pending}
                onBusy={setPhotoBusy}
              />
            </View>
            {step === 1 ? (
              <>
                <Text style={[textStyles.label, { color: p.ink }]}>Measurement system</Text>
                <Controller
                  control={control}
                  name="measurement_system"
                  render={({ field: { value, onChange } }) => (
                    <View
                      accessibilityRole="radiogroup"
                      accessibilityLabel="Measurement system"
                      style={{ flexDirection: 'row', gap: 12 }}
                    >
                      {(['metric', 'imperial'] as const).map((unit) => (
                        <Pressable
                          key={unit}
                          accessibilityRole="radio"
                          accessibilityLabel={unit === 'metric' ? 'Metric' : 'Imperial'}
                          accessibilityState={{
                            selected: value === unit,
                            checked: value === unit,
                            disabled,
                          }}
                          disabled={disabled}
                          onPress={() => {
                            if (!value && account.profile.weight_kg !== null)
                              setValue('weight', displayWeight(account.profile.weight_kg, unit));
                            if (value && value !== unit) {
                              const values = getValues();
                              if (/^\d+(?:\.\d{1,2})?$/.test(values.weight))
                                setValue(
                                  'weight',
                                  displayWeight(
                                    savedWeight(values.weight, value, account.profile.weight_kg),
                                    unit,
                                  ),
                                );
                              const heightValid =
                                value === 'metric'
                                  ? /^\d+(?:\.\d{1,2})?$/.test(values.height_cm)
                                  : /^\d+$/.test(values.height_ft) &&
                                    /^\d+(?:\.\d{1,2})?$/.test(values.height_in);
                              if (heightValid) {
                                const height = displayHeight(
                                  savedHeight(values, value, account.profile.height_cm),
                                );
                                setValue('height_cm', height.height_cm);
                                setValue('height_ft', height.height_ft);
                                setValue('height_in', height.height_in);
                              }
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
                            {unit === 'metric' ? 'Metric' : 'Imperial'}
                            {value === unit ? ' ✓' : ''}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                />
                {errors.measurement_system ? (
                  <Text accessibilityRole="alert" style={{ color: p.danger }}>
                    {errors.measurement_system.message}
                  </Text>
                ) : null}
                <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                  Metric uses kg and cm. Imperial uses lb, feet and inches. Switching converts your
                  measurements.
                </Text>
              </>
            ) : null}
            {fields
              .filter(([name]) =>
                step === 0
                  ? name === 'display_name'
                  : step === 1
                    ? name === 'age' ||
                      (unit !== null &&
                        name !== 'display_name' &&
                        (unit === 'metric'
                          ? name !== 'height_ft' && name !== 'height_in'
                          : name !== 'height_cm'))
                    : false,
              )
              .map(([name, label]) => (
                <View key={name} style={{ gap: 8 }}>
                  <Text style={[textStyles.label, { color: p.ink }]}>
                    {name === 'weight' && unit
                      ? `Weight (${unit === 'metric' ? 'kg' : 'lb'})`
                      : label}
                  </Text>
                  <Controller
                    control={control}
                    name={name}
                    render={({ field: { value, onChange, onBlur } }) => (
                      <TextField
                        accessibilityLabel={label}
                        value={value}
                        onChangeText={onChange}
                        onBlur={() => {
                          if (
                            name !== 'display_name' &&
                            name !== 'age' &&
                            name !== 'height_ft' &&
                            /^\d+(?:\.\d{1,2})?$/.test(value)
                          )
                            onChange(Number(value).toFixed(2));
                          onBlur();
                        }}
                        editable={!disabled}
                        autoCapitalize={name === 'display_name' ? 'words' : 'none'}
                        autoCorrect={false}
                        keyboardType={name === 'display_name' ? 'default' : 'decimal-pad'}
                        invalid={Boolean(errors[name])}
                        inputStyle={textStyles.body}
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
            {step === 2 ? (
              <>
                <ProfileAvatar
                  account={
                    photoDraft.kind === 'remove'
                      ? { ...photoAccount, profile: { ...photoAccount.profile, picture_url: null } }
                      : photoAccount
                  }
                  preview={photoDraft.kind === 'select' ? photoDraft.asset.uri : undefined}
                />
                {[
                  ['Name', getValues('display_name')],
                  ['Age', `${getValues('age')} years`],
                  ['System', unit === 'metric' ? 'Metric' : 'Imperial'],
                  [
                    'Height',
                    unit === 'imperial'
                      ? `${getValues('height_ft')} ft ${Number(getValues('height_in')).toFixed(2)} in`
                      : `${Number(getValues('height_cm')).toFixed(2)} cm`,
                  ],
                  [
                    'Weight',
                    `${Number(getValues('weight')).toFixed(2)} ${unit === 'imperial' ? 'lb' : 'kg'}`,
                  ],
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
            title={pending ? 'Saving…' : step === 2 ? 'Save profile' : 'Continue'}
            disabled={disabled}
            onPress={() => {
              if (step === 2) void save();
              else advance();
            }}
          />
          {onCancel ? (
            <SetupButton
              title="Cancel"
              secondary
              disabled={disabled}
              onPress={() => {
                onCancel();
              }}
            />
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
