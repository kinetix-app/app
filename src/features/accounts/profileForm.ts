import { z } from 'zod/v4';
import { weightUnitSchema, type Account } from './schemas';

const numericText = (max: number, places: number) =>
  z
    .string()
    .regex(new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`), 'Enter a positive number.')
    .refine(
      (value) => Number(value) > 0 && Number(value) <= max,
      `Enter a value greater than 0 and at most ${max}.`,
    );
export const profileFormSchema = z
  .object({
    display_name: z.string().trim().min(1, 'Enter your name.').max(100),
    age: z
      .string()
      .regex(/^\d+$/, 'Enter your age in years.')
      .refine((value) => Number(value) >= 1 && Number(value) <= 120, 'Enter an age from 1 to 120.'),
    height_cm: numericText(300, 2),
    weight: numericText(2204.622621, 6),
    weight_unit: weightUnitSchema.nullable().refine((value) => value !== null, 'Choose kg or lb.'),
  })
  .refine(
    (value) =>
      !value.weight_unit ||
      !/^\d+(?:\.\d{1,6})?$/.test(value.weight) ||
      (Number(canonicalWeight(value.weight, value.weight_unit)) > 0 &&
        Number(canonicalWeight(value.weight, value.weight_unit)) <= 1000),
    { path: ['weight'], message: 'Weight must be greater than 0 and at most 1000 kg.' },
  );
export type ProfileFormValues = z.infer<typeof profileFormSchema>;

/** Decimal arithmetic: 1 lb = exactly 0.45359237 kg; half-up to 6 decimal kg. */
export function canonicalWeight(value: string, unit: 'kg' | 'lb') {
  const [integer, fraction = ''] = value.split('.');
  const scaled = BigInt(integer) * 1000000n + BigInt(fraction.padEnd(6, '0'));
  const kg = unit === 'kg' ? scaled : (scaled * 45359237n + 50000000n) / 100000000n;
  return `${kg / 1000000n}.${String(kg % 1000000n).padStart(6, '0')}`;
}
export function profileDefaults(account: Account): ProfileFormValues {
  const p = account.profile;
  return {
    display_name: p.display_name ?? '',
    age: p.age === null ? '' : String(p.age),
    height_cm: p.height_cm ?? '',
    weight:
      p.weight_kg === null
        ? ''
        : p.weight_unit === 'lb'
          ? (Number(p.weight_kg) / 0.45359237).toFixed(6)
          : p.weight_kg,
    weight_unit: p.weight_unit,
  };
}
