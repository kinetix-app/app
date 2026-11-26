import { useLanguage } from '@/i18n/Language';
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
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { ProfileBack } from './ProfileBack';
import { MeasurementSystemSelector } from '@/components/MeasurementSystemSelector';
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

const profileErrors: Record<string, string> = {
  'Enter your name.': 'Introduce tu nombre.',
  'Enter your age in years.': 'Introduce tu edad en años.',
  'Enter an age from 1 to 120.': 'Introduce una edad entre 1 y 120 años.',
  'Enter a positive weight with at most two decimals.':
    'Introduce un peso positivo con dos decimales como máximo.',
  'Weight must be greater than 0 and at most 1000 kg.':
    'El peso debe ser mayor que 0 y no superar 1000 kg.',
  'Enter a height greater than 0 and at most 300 cm, with at most two decimals.':
    'Introduce una altura mayor que 0 y no superior a 300 cm, con dos decimales como máximo.',
  'Enter whole feet from 0 to 9.': 'Introduce pies enteros entre 0 y 9.',
  'Enter inches from 0 to less than 12, with at most two decimals.':
    'Introduce pulgadas desde 0 hasta menos de 12, con dos decimales como máximo.',
  'Total height must be greater than 0 and at most 300 cm.':
    'La altura total debe ser mayor que 0 y no superar 300 cm.',
  'Choose Male or Female.': 'Elige hombre o mujer.',
  'Choose your usual activity level.': 'Elige tu nivel de actividad habitual.',
  'Choose Metric or Imperial.': 'Elige métrico o imperial.',
};
function localError(message: string | undefined, es: boolean) {
  return message && es ? (profileErrors[message] ?? message) : message;
}

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
  active?: boolean;
  mode?: 'onboarding' | 'edit';
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
  if (step === 3) return 'Save profile';
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

function LanguageFields({ form, disabled }: Readonly<{ form: ProfileFormApi; disabled: boolean }>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <Controller
      control={form.control}
      name="language"
      render={({ field: { value, onChange } }) => (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={es ? 'Idioma' : 'Language'}
          style={{ gap: spacing['space-2'] }}
        >
          <Text style={[textStyles.label, { color: p.ink }]}>Language / Idioma</Text>
          <View style={{ flexDirection: 'row', gap: spacing['space-3'] }}>
            {(
              [
                ['en', 'English'],
                ['es', 'Español'],
              ] as const
            ).map(([code, label]) => (
              <Pressable
                key={code}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked: value === code, disabled }}
                aria-checked={value === code}
                disabled={disabled}
                onPress={() => onChange(code)}
                style={{
                  minHeight: sizes['tap-min'],
                  padding: spacing['space-3'],
                  borderRadius: radii['radius-md'],
                  borderWidth: 2,
                  borderColor: value === code ? p.brand : p['line-strong'],
                  backgroundColor: value === code ? p['brand-soft'] : p['surface-200'],
                }}
              >
                <Text
                  style={[textStyles.label, { color: value === code ? p['brand-ink'] : p.ink }]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    />
  );
}

type MeasurementSystemFieldsProps = Readonly<{
  account: Account;
  disabled: boolean;
  error?: string;
  form: ProfileFormApi;
  compact?: boolean;
}>;

function MeasurementSystemFields({
  account,
  disabled,
  error,
  form,
  compact = false,
}: MeasurementSystemFieldsProps) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <>
      <Text style={[textStyles.label, { color: p.ink }]}>
        {es ? 'Sistema de medidas' : 'Measurement system'}
      </Text>
      <Controller
        control={form.control}
        name="measurement_system"
        render={({ field: { value, onChange } }) => (
          <MeasurementSystemSelector
            value={value}
            disabled={disabled}
            onChange={(unit) => {
              updateMeasurementsForUnit(unit, value, account, form);
              onChange(unit);
            }}
          />
        )}
      />
      {error ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          {localError(error, es)}
        </Text>
      ) : null}
      {!compact ? (
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {es
            ? 'El sistema métrico usa kg y cm. El imperial usa lb, pies y pulgadas. Al cambiar se convierten las medidas.'
            : 'Metric uses kg and cm. Imperial uses lb, feet and inches. Switching converts your measurements.'}
        </Text>
      ) : null}
    </>
  );
}

type ProfileFieldsProps = Readonly<{
  disabled: boolean;
  errors: FieldErrors<ProfileFormValues>;
  form: ProfileFormApi;
  step: number;
  unit: ProfileFormValues['measurement_system'];
  compact?: boolean;
  group?: 'ageWeight' | 'height';
}>;

function ProfileFields({
  disabled,
  errors,
  form,
  step,
  unit,
  compact = false,
  group,
}: ProfileFieldsProps) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return fields
    .filter(([name]) => shouldShowField(name, step, unit))
    .filter(
      ([name]) =>
        !group ||
        (group === 'ageWeight' ? name === 'age' || name === 'weight' : name.startsWith('height_')),
    )
    .map(([name, label]) => (
      <View
        key={name}
        style={[
          { gap: spacing['space-2'], marginTop: compact ? 0 : spacing['space-2'] },
          compact && { flexGrow: 1, flexBasis: 140 },
        ]}
      >
        <Text style={[textStyles.label, { color: p.ink }]}>
          {es
            ? (
                {
                  display_name: 'Nombre',
                  age: 'Edad (años)',
                  height_cm: 'Altura (cm)',
                  height_ft: 'Altura (pies)',
                  height_in: 'Altura (pulgadas)',
                  weight: unit === 'imperial' ? 'Peso (lb)' : 'Peso (kg)',
                } as const
              )[name]
            : displayFieldLabel(name, label, unit)}
        </Text>
        <Controller
          control={form.control}
          name={name}
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              accessibilityLabel={
                es
                  ? (
                      {
                        display_name: 'Nombre',
                        age: 'Edad (años)',
                        height_cm: 'Altura (cm)',
                        height_ft: 'Altura (pies)',
                        height_in: 'Altura (pulgadas)',
                        weight: 'Peso',
                      } as const
                    )[name]
                  : label
              }
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
            {localError(errors[name]?.message, es)}
          </Text>
        ) : null}
      </View>
    ));
}

function accountForPictureDraft(account: Account, draft: ProfilePictureDraft) {
  if (draft.kind !== 'remove') return account;
  return { ...account, profile: { ...account.profile, picture_url: null } };
}

function fieldOpacity(disabled: boolean, pressed: boolean): number {
  if (disabled) return 0.5;
  return pressed ? 0.75 : 1;
}

function SexFields({
  form,
  disabled,
  error,
}: Readonly<{
  form: ProfileFormApi;
  disabled: boolean;
  error?: string;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <View style={{ gap: spacing['space-3'], marginTop: spacing['space-2'] }}>
      <Text style={[textStyles.label, { color: p.ink }]}>{es ? 'Sexo' : 'Sex'}</Text>
      <Controller
        control={form.control}
        name="sex"
        render={({ field: { value, onChange } }) => (
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={es ? 'Sexo' : 'Sex'}
            style={{ flexDirection: 'row', gap: 12 }}
          >
            {(['male', 'female'] as const).map((sex) => (
              <Pressable
                key={sex}
                accessibilityRole="radio"
                accessibilityLabel={
                  sex === 'male' ? (es ? 'Hombre' : 'Male') : es ? 'Mujer' : 'Female'
                }
                accessibilityState={{ checked: value === sex, disabled }}
                aria-checked={value === sex}
                disabled={disabled}
                onPress={() => onChange(sex)}
                style={({ pressed }) => [
                  s.field,
                  {
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 999,
                    borderWidth: 2,
                    borderColor: value === sex ? p.brand : p['line-strong'],
                    backgroundColor: value === sex ? p.brand : p['surface-200'],
                    opacity: fieldOpacity(disabled, pressed),
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <Text
                  style={[
                    textStyles.label,
                    { color: value === sex ? p['on-brand'] : p.ink, textAlign: 'center' },
                  ]}
                >
                  {sex === 'male' ? (es ? 'Hombre' : 'Male') : es ? 'Mujer' : 'Female'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      />
      {error ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          {localError(error, es)}
        </Text>
      ) : null}
    </View>
  );
}

export const activityOptions = [
  {
    value: 'sedentary',
    label: 'Sedentary',
    labelEs: 'Sedentario',
    descriptionEs:
      'Poco movimiento o trabajo de oficina, sin entrenamiento de fuerza ni cardio semanal.',
    description: 'Little movement or office work, no strength training and no weekly cardio.',
  },
  {
    value: 'light',
    label: 'Light',
    labelEs: 'Ligero',
    descriptionEs: '1–3 sesiones de fuerza por semana, trabajo de oficina y sin cardio.',
    description: '1–3 strength sessions per week, office work and no cardio.',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    labelEs: 'Moderado',
    descriptionEs:
      '3–5 sesiones de fuerza por semana, trabajo de oficina y una sesión de cardio o caminatas diarias.',
    description:
      '3–5 strength sessions per week, office work, plus one cardio session or daily walking.',
  },
  {
    value: 'high',
    label: 'High',
    labelEs: 'Alto',
    descriptionEs:
      '5 o más sesiones de fuerza por semana, trabajo de pie o más de 2 sesiones de cardio.',
    description:
      '5+ strength sessions per week, plus standing work or more than 2 cardio sessions per week.',
  },
  {
    value: 'very_high',
    label: 'Very high',
    labelEs: 'Muy alto',
    descriptionEs:
      '5 o más sesiones de fuerza por semana, actividad física intensa, trabajo físico y más de 3 sesiones de cardio.',
    description:
      '5+ strength sessions per week, intense physical activity and physical work, plus more than 3 cardio sessions per week.',
  },
] as const;

export function ActivityFields({
  form,
  disabled,
  error,
}: Readonly<{
  form: ProfileFormApi;
  disabled: boolean;
  error?: string;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <Controller
      control={form.control}
      name="activity_level"
      render={({ field: { value, onChange } }) => (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={es ? 'Actividad habitual' : 'Usual activity'}
          style={{ gap: spacing['space-3'] }}
        >
          {activityOptions.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={`${es ? option.labelEs : option.label}. ${es ? option.descriptionEs : option.description}`}
              accessibilityState={{ checked: value === option.value, disabled }}
              aria-checked={value === option.value}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => ({
                padding: spacing['space-4'],
                gap: spacing['space-2'],
                borderRadius: radii['radius-md'],
                borderWidth: 2,
                borderColor: value === option.value ? p.brand : p['line-strong'],
                backgroundColor: value === option.value ? p['brand-soft'] : p['surface-200'],
                opacity: fieldOpacity(disabled, pressed),
              })}
            >
              <Text
                style={[
                  textStyles.label,
                  { color: value === option.value ? p['brand-ink'] : p.ink },
                ]}
              >
                {es ? option.labelEs : option.label}
              </Text>
              <Text
                style={[
                  textStyles['body-sm'],
                  { color: value === option.value ? p['brand-ink'] : p['ink-muted'] },
                ]}
              >
                {es ? option.descriptionEs : option.description}
              </Text>
            </Pressable>
          ))}
          {error ? (
            <Text accessibilityRole="alert" style={{ color: p.danger }}>
              {localError(error, es)}
            </Text>
          ) : null}
        </View>
      )}
    />
  );
}

function profileReviewRows(form: ProfileFormApi, unit: 'metric' | 'imperial', es: boolean) {
  const values = form.getValues();
  const height =
    unit === 'imperial'
      ? `${values.height_ft} ft ${Number(values.height_in).toFixed(2)} in`
      : `${Number(values.height_cm).toFixed(2)} cm`;
  const weightUnit = unit === 'imperial' ? 'lb' : 'kg';
  const sexLabels = es ? { male: 'Hombre', female: 'Mujer' } : { male: 'Male', female: 'Female' };
  const sex = values.sex ? (sexLabels[values.sex] ?? '—') : '—';
  return [
    [es ? 'Nombre' : 'Name', values.display_name],
    [es ? 'Edad' : 'Age', `${values.age} ${es ? 'años' : 'years'}`],
    [
      es ? 'Actividad' : 'Activity',
      (() => {
        const option = activityOptions.find((item) => item.value === values.activity_level);
        return option ? (es ? option.labelEs : option.label) : '—';
      })(),
    ],
    [es ? 'Sexo' : 'Sex', sex],
    [es ? 'Sistema' : 'System', unit === 'metric' ? (es ? 'Métrico' : 'Metric') : 'Imperial'],
    [es ? 'Altura' : 'Height', height],
    [es ? 'Peso' : 'Weight', `${Number(values.weight).toFixed(2)} ${weightUnit}`],
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
  const es = useLanguage() === 'es';
  const preview = draft.kind === 'select' ? draft.asset.uri : undefined;
  return (
    <>
      <ProfileAvatar account={accountForPictureDraft(account, draft)} preview={preview} />
      {profileReviewRows(form, unit, es).map(([label, value]) => (
        <View key={label} style={wizard.reviewRow}>
          <Text style={[textStyles.body, { color: p['ink-muted'] }]}>{label}</Text>
          <Text style={[textStyles.label, { color: p.ink, flexShrink: 1 }]}>{value}</Text>
        </View>
      ))}
    </>
  );
}

function fieldsForStep(step: number): string[] {
  if (step === 0) return ['display_name'];
  if (step === 2) return ['activity_level'];
  return ['age', 'sex', 'measurement_system', 'weight', 'height_cm', 'height_ft', 'height_in'];
}

export function ProfileEditor({
  account,
  onSaved,
  onCancel,
  active = true,
  mode = 'onboarding',
}: ProfileEditorProps) {
  const p = usePalette();
  const es = useLanguage() === 'es';
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
  const steps = es
    ? ['Sobre ti', 'Información personal', 'Actividad habitual', 'Confirmación']
    : ['About you', 'Personal information', 'Usual activity', 'Confirmation'];
  const disabled = pending || photoBusy;
  function back() {
    if (disabled) return;
    if (mode === 'onboarding' && step > 0) setStep((value) => value - 1);
    else onCancel?.();
  }
  useHardwareBack(
    () => {
      back();
      return true;
    },
    active && (step > 0 || Boolean(onCancel)),
  );
  function advance() {
    clearErrors();
    const issues = currentStepIssues(getValues(), fieldsForStep(step));
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
      if (!value?.measurement_system) return;
      busy.current = true;
      setPending(true);
      setFailure('');
      try {
        await applyPictureDraft(photoDraft, appliedPhoto, setPhotoAccount);
        const result = await updateProfile(apiClient, {
          language: value.language,
          display_name: value.display_name,
          age: Number(value.age),
          height_cm: savedHeight(value, value.measurement_system, account.profile.height_cm),
          weight_kg: savedWeight(value.weight, value.measurement_system, account.profile.weight_kg),
          measurement_system: value.measurement_system,
          sex: value.sex,
          activity_level: value.activity_level,
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
  if (mode === 'edit')
    return (
      <ProfileEditForm
        account={account}
        photoAccount={photoAccount}
        photoDraft={photoDraft}
        setPhotoDraft={setPhotoDraft}
        pending={pending}
        setPhotoBusy={setPhotoBusy}
        disabled={disabled}
        errors={errors}
        form={form}
        unit={unit}
        failure={failure}
        onBack={onCancel ? back : undefined}
        onSave={() => void save()}
      />
    );
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
          <ProfileWizardHeader step={step} disabled={disabled} onCancel={onCancel} onBack={back} />
          <View style={{ gap: spacing['space-2'] }}>
            <Text
              accessibilityLiveRegion="polite"
              style={[textStyles.label, { color: p['ink-muted'] }]}
            >
              {es ? 'Paso' : 'Step'} {step + 1} {es ? 'de' : 'of'} 4 · {steps[step]}
            </Text>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={
                es ? 'Progreso de configuración del perfil' : 'Profile setup progress'
              }
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
                (es
                  ? [
                      'Empieza con tu nombre y una foto de perfil opcional.',
                      'Añade tu edad, elige el sistema de medidas e introduce tus medidas.',
                      'Elige la opción que mejor describa tu semana habitual. La usaremos para estimar tus calorías diarias.',
                      'Revisa tus datos antes de guardar.',
                    ]
                  : [
                      'Start with your name and an optional profile picture.',
                      'Add your age, choose your measurement system and enter your measurements.',
                      'Choose the option that best describes your usual week. We’ll use it to estimate your daily calorie needs.',
                      'Take a moment to check your details before saving.',
                    ])[step]
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
            {step === 0 ? <LanguageFields form={form} disabled={disabled} /> : null}
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
              <ActivityFields
                form={form}
                disabled={disabled}
                error={errors.activity_level?.message}
              />
            ) : null}
            {step === 3 ? (
              <ProfileReview
                account={photoAccount}
                draft={photoDraft}
                form={form}
                unit={unit ?? 'metric'}
              />
            ) : null}
            {step === 1 ? (
              <SexFields form={form} disabled={disabled} error={errors.sex?.message} />
            ) : null}
          </View>
          {failure ? (
            <Text accessibilityRole="alert" style={{ color: p.danger }}>
              {es
                ? 'No se pudo guardar tu perfil. Conservamos tus datos y la foto elegida. Inténtalo de nuevo.'
                : failure}
            </Text>
          ) : null}
          <SetupButton
            title={
              es
                ? pending
                  ? 'Guardando…'
                  : step === 3
                    ? 'Guardar perfil'
                    : 'Continuar'
                : saveButtonTitle(pending, step)
            }
            disabled={disabled}
            onPress={() => {
              if (step === 3) void save();
              else advance();
            }}
          />
          {onCancel ? (
            <SetupButton
              title={es ? 'Cancelar' : 'Cancel'}
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
  progress: { flexDirection: 'row', gap: spacing['space-2'] },
  segment: { flex: 1, height: spacing['space-1'], borderRadius: radii['radius-pill'] },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing['space-4'],
    paddingVertical: spacing['space-2'],
  },
});

function ProfileEditForm({
  account,
  photoAccount,
  photoDraft,
  setPhotoDraft,
  pending,
  setPhotoBusy,
  disabled,
  errors,
  form,
  unit,
  failure,
  onBack,
  onSave,
}: Readonly<{
  account: Account;
  photoAccount: Account;
  photoDraft: ProfilePictureDraft;
  setPhotoDraft: (draft: ProfilePictureDraft) => void;
  pending: boolean;
  setPhotoBusy: (busy: boolean) => void;
  disabled: boolean;
  errors: FieldErrors<ProfileFormValues>;
  form: ProfileFormApi;
  unit: ProfileFormValues['measurement_system'];
  failure: string;
  onBack?: () => void;
  onSave: () => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[s.screen, { backgroundColor: p['surface-100'] }]}
    >
      <KeyboardAvoidingView
        style={s.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.content, { gap: spacing['space-4'] }]}
        >
          <ScreenHeader
            title={es ? 'Editar perfil' : 'Edit profile'}
            leading={onBack ? <ProfileBack disabled={disabled} onPress={onBack} /> : undefined}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={es ? 'Guardar perfil' : 'Save profile'}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={onSave}
              style={{
                minHeight: sizes['tap-min'],
                paddingHorizontal: spacing['space-4'],
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radii['radius-md'],
                backgroundColor: p.brand,
                opacity: disabled ? 0.55 : 1,
              }}
            >
              <Text style={[textStyles.label, { color: p['on-brand'] }]}>
                {pending ? (es ? 'Guardando…' : 'Saving…') : es ? 'Guardar' : 'Save'}
              </Text>
            </Pressable>
          </ScreenHeader>
          <ProfilePictureEditor
            compact
            account={photoAccount}
            draft={photoDraft}
            onDraftChange={setPhotoDraft}
            disabled={pending}
            onBusy={setPhotoBusy}
          />
          <LanguageFields form={form} disabled={disabled} />
          <ProfileFields disabled={disabled} errors={errors} form={form} step={0} unit={unit} />
          <MeasurementSystemFields
            compact
            account={account}
            disabled={disabled}
            error={errors.measurement_system?.message}
            form={form}
          />
          {(['ageWeight', 'height'] as const).map((group) => (
            <View
              key={group}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-3'] }}
            >
              <ProfileFields
                compact
                group={group}
                disabled={disabled}
                errors={errors}
                form={form}
                step={1}
                unit={unit}
              />
            </View>
          ))}
          <SexFields form={form} disabled={disabled} error={errors.sex?.message} />
          <ActivityFields form={form} disabled={disabled} error={errors.activity_level?.message} />
          {failure ? (
            <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
              {es
                ? 'No se pudo guardar tu perfil. Conservamos tus datos y la foto elegida. Inténtalo de nuevo.'
                : failure}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ProfileWizardHeader({
  step,
  disabled,
  onCancel,
  onBack,
}: Readonly<{
  step: number;
  disabled: boolean;
  onCancel?: () => void;
  onBack: () => void;
}>) {
  const es = useLanguage() === 'es';
  return (
    <ScreenHeader
      leading={
        step > 0 || onCancel ? (
          <ProfileBack
            label={
              step > 0 ? (es ? 'Volver' : 'Back') : es ? 'Volver al perfil' : 'Back to profile'
            }
            disabled={disabled}
            onPress={onBack}
          />
        ) : undefined
      }
      title={onCancel ? (es ? 'Editar perfil' : 'Edit profile') : es ? 'Tu perfil' : 'Your profile'}
    />
  );
}
