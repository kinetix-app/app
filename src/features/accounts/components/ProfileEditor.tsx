import React, { useRef, useState } from 'react';
import {
  Controller,
  useForm,
  useWatch,
  type FieldErrors,
  type UseFormReturn,
} from 'react-hook-form';
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
type ProfileEditorProps = Readonly<{
  account: Account;
  onSaved: (account: Account) => void;
  onCancel?: () => void;
}>;
type ProfileFieldName = (typeof fields)[number][0];
type ProfileFormApi = Pick<UseFormReturn<ProfileFormValues>, 'control' | 'getValues' | 'setValue'>;

function currentStepIssues(values: ProfileFormValues, currentFields: string[]) {
  const parsed = profileFormSchema.safeParse(values);
  if (parsed.success) return [];
  return parsed.error.issues.filter((issue) => currentFields.includes(String(issue.path[0])));
}

function submittedProfileValues(
  raw: ProfileFormValues,
  setError: (name: keyof ProfileFormValues, error: { message: string }) => void,
): ProfileFormValues | undefined {
  const parsed = profileFormSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  parsed.error.issues.forEach((issue) =>
    setError(issue.path[0] as keyof ProfileFormValues, { message: issue.message }),
  );
  return undefined;
}

async function applyPictureDraft(
  draft: ProfilePictureDraft,
  appliedDraft: { current: ProfilePictureDraft | undefined },
  setPhotoAccount: (account: Account) => void,
) {
  if (appliedDraft.current === draft) return;
  if (draft.kind === 'select') {
    const asset = draft.asset;
    const form = new FormData();
    if (Platform.OS === 'web' && asset.file) {
      form.append('file', asset.file, asset.fileName ?? 'profile.jpg');
    } else {
      form.append('file', {
        uri: asset.uri,
        name: asset.fileName ?? 'profile.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      } as unknown as Blob);
    }
    setPhotoAccount(await uploadProfilePicture(form));
  } else if (draft.kind === 'remove') {
    setPhotoAccount(await removeProfilePicture());
  }
  appliedDraft.current = draft;
}

function shouldShowField(
  name: ProfileFieldName,
  step: number,
  unit: ProfileFormValues['measurement_system'],
) {
  if (step === 0) return name === 'display_name';
  if (step !== 1) return false;
  if (name === 'age') return true;
  if (!unit || name === 'display_name') return false;
  if (unit === 'metric') return name !== 'height_ft' && name !== 'height_in';
  return name !== 'height_cm';
}

function displayFieldLabel(
  name: ProfileFieldName,
  label: string,
  unit: ProfileFormValues['measurement_system'],
) {
  if (name !== 'weight' || !unit) return label;
  return unit === 'metric' ? 'Weight (kg)' : 'Weight (lb)';
}

function saveButtonTitle(pending: boolean, step: number) {
  if (pending) return 'Saving…';
  if (step === 2) return 'Save profile';
  return 'Continue';
}

function updateMeasurementsForUnit(
  nextUnit: 'metric' | 'imperial',
  currentUnit: ProfileFormValues['measurement_system'],
  account: Account,
  form: ProfileFormApi,
) {
  if (!currentUnit && account.profile.weight_kg !== null) {
    form.setValue('weight', displayWeight(account.profile.weight_kg, nextUnit));
  }
  if (!currentUnit || currentUnit === nextUnit) return;

  const values = form.getValues();
  if (/^\d+(?:\.\d{1,2})?$/.test(values.weight)) {
    form.setValue(
      'weight',
      displayWeight(savedWeight(values.weight, currentUnit, account.profile.weight_kg), nextUnit),
    );
  }
  const heightValid =
    currentUnit === 'metric'
      ? /^\d+(?:\.\d{1,2})?$/.test(values.height_cm)
      : /^\d+$/.test(values.height_ft) && /^\d+(?:\.\d{1,2})?$/.test(values.height_in);
  if (!heightValid) return;

  const height = displayHeight(savedHeight(values, currentUnit, account.profile.height_cm));
  form.setValue('height_cm', height.height_cm);
  form.setValue('height_ft', height.height_ft);
  form.setValue('height_in', height.height_in);
}

type MeasurementSystemFieldsProps = Readonly<{
  account: Account;
  disabled: boolean;
  error?: string;
  form: ProfileFormApi;
}>;

function MeasurementSystemFields({ account, disabled, error, form }: MeasurementSystemFieldsProps) {
  const p = usePalette();
  return (
    <>
      <Text style={[textStyles.label, { color: p.ink }]}>Measurement system</Text>
      <Controller
        control={form.control}
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
                  updateMeasurementsForUnit(unit, value, account, form);
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
      {error ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          {error}
        </Text>
      ) : null}
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        Metric uses kg and cm. Imperial uses lb, feet and inches. Switching converts your
        measurements.
      </Text>
    </>
  );
}

type ProfileFieldsProps = Readonly<{
  disabled: boolean;
  errors: FieldErrors<ProfileFormValues>;
  form: ProfileFormApi;
  step: number;
  unit: ProfileFormValues['measurement_system'];
}>;

function ProfileFields({ disabled, errors, form, step, unit }: ProfileFieldsProps) {
  const p = usePalette();
  return fields
    .filter(([name]) => shouldShowField(name, step, unit))
    .map(([name, label]) => (
      <View key={name} style={{ gap: 8 }}>
        <Text style={[textStyles.label, { color: p.ink }]}>
          {displayFieldLabel(name, label, unit)}
        </Text>
        <Controller
          control={form.control}
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
                ) {
                  onChange(Number(value).toFixed(2));
                }
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
    ));
}

function accountForPictureDraft(account: Account, draft: ProfilePictureDraft) {
  if (draft.kind !== 'remove') return account;
  return { ...account, profile: { ...account.profile, picture_url: null } };
}

function profileReviewRows(form: ProfileFormApi, unit: 'metric' | 'imperial') {
  const values = form.getValues();
  const height =
    unit === 'imperial'
      ? `${values.height_ft} ft ${Number(values.height_in).toFixed(2)} in`
      : `${Number(values.height_cm).toFixed(2)} cm`;
  const weightUnit = unit === 'imperial' ? 'lb' : 'kg';
  return [
    ['Name', values.display_name],
    ['Age', `${values.age} years`],
    ['System', unit === 'metric' ? 'Metric' : 'Imperial'],
    ['Height', height],
    ['Weight', `${Number(values.weight).toFixed(2)} ${weightUnit}`],
  ];
}

type ProfileReviewProps = Readonly<{
  account: Account;
  draft: ProfilePictureDraft;
  form: ProfileFormApi;
  unit: 'metric' | 'imperial';
}>;

function ProfileReview({ account, draft, form, unit }: ProfileReviewProps) {
  const p = usePalette();
  const preview = draft.kind === 'select' ? draft.asset.uri : undefined;
  return (
    <>
      <ProfileAvatar account={accountForPictureDraft(account, draft)} preview={preview} />
      {profileReviewRows(form, unit).map(([label, value]) => (
        <View key={label} style={wizard.reviewRow}>
          <Text style={[textStyles.body, { color: p['ink-muted'] }]}>{label}</Text>
          <Text style={[textStyles.label, { color: p.ink, flexShrink: 1 }]}>{value}</Text>
        </View>
      ))}
    </>
  );
}

export function ProfileEditor({ account, onSaved, onCancel }: ProfileEditorProps) {
  const p = usePalette();
  const defaults = profileDefaults(account);
  const form = useForm<ProfileFormValues>({ defaultValues: defaults });
  const {
    handleSubmit,
    setError,
    clearErrors,
    getValues,
    formState: { errors },
  } = form;
  const unit = useWatch({ control: form.control, name: 'measurement_system' });
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
    const issues = currentStepIssues(getValues(), currentFields);
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
      const value = submittedProfileValues(raw, setError);
      if (!value || !value.measurement_system) return;
      busy.current = true;
      setPending(true);
      setFailure('');
      try {
        await applyPictureDraft(photoDraft, appliedPhoto, setPhotoAccount);
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
              <MeasurementSystemFields
                account={account}
                disabled={disabled}
                error={errors.measurement_system?.message}
                form={form}
              />
            ) : null}
            <ProfileFields
              disabled={disabled}
              errors={errors}
              form={form}
              step={step}
              unit={unit}
            />
            {step === 2 ? (
              <ProfileReview
                account={photoAccount}
                draft={photoDraft}
                form={form}
                unit={unit ?? 'metric'}
              />
            ) : null}
          </View>
          {failure ? (
            <Text accessibilityRole="alert" style={{ color: p.danger }}>
              {failure}
            </Text>
          ) : null}
          <SetupButton
            title={saveButtonTitle(pending, step)}
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
