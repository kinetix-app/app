import { z } from 'zod/v4';
import { measurementSystemSchema, type Account } from './schemas';

export type MeasurementSystem = 'metric' | 'imperial';
const decimalInput = /^\d+(?:\.\d{1,2})?$/;
const cents = (value: string) => {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
};
const fixed = (value: bigint, places = 2) => {
  const scale = 10n ** BigInt(places);
  return `${value / scale}.${String(value % scale).padStart(places, '0')}`;
};

/** Exact decimal conversion: 1 lb = 0.45359237 kg; canonical kg rounds half-up to six places. */
export function canonicalWeight(value: string, system: MeasurementSystem) {
  const amount = cents(value);
  return fixed(system === 'metric' ? amount * 10000n : (amount * 45359237n + 5000n) / 10000n, 6);
}
export function displayWeight(kg: string, system: MeasurementSystem) {
  const [whole, fraction = ''] = kg.split('.');
  const scaled = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
  return fixed(
    system === 'metric' ? (scaled + 5000n) / 10000n : (scaled * 10000n + 22679618n) / 45359237n,
  );
}

/** 1 inch = exactly 2.54 cm; canonical cm rounds half-up to two places. */
export function canonicalHeight(
  value: Pick<ProfileFormValues, 'height_cm' | 'height_ft' | 'height_in'>,
  system: MeasurementSystem,
) {
  if (system === 'metric') return fixed(cents(value.height_cm));
  const inches = BigInt(value.height_ft) * 1200n + cents(value.height_in);
  return fixed((inches * 254n + 50n) / 100n);
}
export function displayHeight(cm: string) {
  const totalInches = (cents(cm) * 100n + 127n) / 254n;
  return {
    height_cm: fixed(cents(cm)),
    height_ft: String(totalInches / 1200n),
    height_in: fixed(totalInches % 1200n),
  };
}

const profileFormShape = z.object({
  display_name: z.string().trim().min(1, 'Enter your name.').max(100),
  age: z
    .string()
    .regex(/^\d+$/, 'Enter your age in years.')
    .refine((value) => Number(value) >= 1 && Number(value) <= 120, 'Enter an age from 1 to 120.'),
  height_cm: z.string(),
  height_ft: z.string(),
  height_in: z.string(),
  weight: z.string(),
  measurement_system: measurementSystemSchema.nullable(),
});
export type ProfileFormValues = z.infer<typeof profileFormShape>;

type AddProfileIssue = (field: keyof ProfileFormValues, message: string) => void;

function validateWeight(
  value: ProfileFormValues,
  system: MeasurementSystem,
  issue: AddProfileIssue,
) {
  if (!decimalInput.test(value.weight) || Number(value.weight) <= 0) {
    issue('weight', 'Enter a positive weight with at most two decimals.');
  } else {
    const weightKg = Number(canonicalWeight(value.weight, system));
    if (weightKg > 1000 || weightKg <= 0) {
      issue('weight', 'Weight must be greater than 0 and at most 1000 kg.');
    }
  }
}

function validateMetricHeight(value: ProfileFormValues, issue: AddProfileIssue) {
  if (
    !decimalInput.test(value.height_cm) ||
    Number(value.height_cm) <= 0 ||
    Number(value.height_cm) > 300
  ) {
    issue(
      'height_cm',
      'Enter a height greater than 0 and at most 300 cm, with at most two decimals.',
    );
  }
}

function validateImperialHeight(value: ProfileFormValues, issue: AddProfileIssue) {
  const feetValid = /^\d+$/.test(value.height_ft) && Number(value.height_ft) <= 9;
  const inchesValid = decimalInput.test(value.height_in) && Number(value.height_in) < 12;
  if (!feetValid) issue('height_ft', 'Enter whole feet from 0 to 9.');
  if (!inchesValid)
    issue('height_in', 'Enter inches from 0 to less than 12, with at most two decimals.');
  if (feetValid && inchesValid) {
    const cm = Number(canonicalHeight(value, 'imperial'));
    if (cm <= 0 || cm > 300)
      issue('height_in', 'Total height must be greater than 0 and at most 300 cm.');
  }
}

function validateProfileForm(value: ProfileFormValues, context: z.RefinementCtx) {
  const issue: AddProfileIssue = (field, message) =>
    context.addIssue({ code: 'custom', path: [field], message });
  const system = value.measurement_system;
  if (!system) {
    issue('measurement_system', 'Choose Metric or Imperial.');
    return;
  }
  validateWeight(value, system, issue);
  if (system === 'metric') validateMetricHeight(value, issue);
  else validateImperialHeight(value, issue);
}

export const profileFormSchema = profileFormShape.check(z.superRefine(validateProfileForm));

export function profileDefaults(account: Account): ProfileFormValues {
  const p = account.profile;
  return {
    display_name: p.display_name ?? '',
    age: p.age === null ? '' : String(p.age),
    ...(p.height_cm === null
      ? { height_cm: '', height_ft: '', height_in: '' }
      : displayHeight(p.height_cm)),
    weight:
      p.weight_kg === null ? '' : displayWeight(p.weight_kg, p.measurement_system ?? 'metric'),
    measurement_system: p.measurement_system,
  };
}

/** Preserve stored precision when the user only switches display systems. */
export function savedHeight(
  value: ProfileFormValues,
  system: MeasurementSystem,
  original: string | null,
) {
  if (original !== null) {
    const display = displayHeight(original);
    if (
      system === 'metric'
        ? value.height_cm === display.height_cm
        : value.height_ft === display.height_ft && value.height_in === display.height_in
    )
      return original;
  }
  return canonicalHeight(value, system);
}
export function savedWeight(value: string, system: MeasurementSystem, original: string | null) {
  return original !== null && value === displayWeight(original, system)
    ? original
    : canonicalWeight(value, system);
}
