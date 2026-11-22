import {
  measurementDefaults,
  measurementFormSchema,
  measurementSeries,
  shownMeasurement,
  targetFormSchema,
  todayForProfile,
} from '../progressForm';
import { measurementSchema } from '../progressSchemas';

test('applies the profile day at the UTC boundary and rejects an invalid date or empty check-in', () => {
  const instant = new Date('2026-03-01T00:30:00Z');
  expect(todayForProfile('America/New_York', instant)).toBe('2026-02-28');
  expect(todayForProfile(null, instant)).toBe('2026-03-01');
  const schema = measurementFormSchema('metric', '2026-02-28');
  expect(schema.safeParse({ ...measurementDefaults('2026-02-29'), weight_kg: '62' }).success).toBe(
    false,
  );
  expect(schema.safeParse({ ...measurementDefaults('2026-03-01'), weight_kg: '62' }).success).toBe(
    false,
  );
  expect(schema.safeParse(measurementDefaults('2026-02-28')).success).toBe(false);
});

test('converts only entered imperial values and preserves zero percent', () => {
  const values = {
    ...measurementDefaults('2026-02-28'),
    weight_kg: '150',
    height_ft: '5',
    height_in: '7',
    waist_cm: '30',
    body_fat_percentage: '0',
  };
  expect(measurementFormSchema('imperial', '2026-03-01').parse(values)).toEqual({
    date: '2026-02-28',
    weight_kg: '68.038856',
    height_cm: '170.18',
    waist_cm: '76.20',
    body_fat_percentage: '0.00',
  });
  expect(shownMeasurement('height_cm', '170.18', 'imperial')).toBe('5 ft 7.00 in');
  expect(shownMeasurement('waist_cm', '76.20', 'imperial')).toBe('30.00 in');
  expect(shownMeasurement('waist_cm', '-76.20', 'imperial')).toBe('-30.00 in');
  expect(shownMeasurement('body_fat_percentage', '0', 'imperial')).toBe('0.00%');
});

test('validates measurement bounds and preserves the unrounded saved target on a date-only edit', () => {
  const schema = measurementFormSchema('metric', '2026-03-01');
  expect(
    schema.safeParse({
      ...measurementDefaults('2026-02-28'),
      weight_kg: 'Infinity',
      body_fat_percentage: '100.01',
      waist_cm: '0',
    }).success,
  ).toBe(false);
  expect(
    targetFormSchema('imperial', '68.038855').parse({
      weight_kg: '150.00',
      target_date: '2026-10-01',
    }),
  ).toEqual({ weight_kg: '68.038855', target_date: '2026-10-01' });
});

test('graphs the last value per day while accepting sparse and legacy observations', () => {
  const date = '2026-02-28';
  const fields = {
    height_cm: null,
    body_fat_percentage: null,
    muscle_mass_kg: null,
    waist_cm: null,
    chest_cm: null,
    arm_cm: null,
    thigh_cm: null,
  };
  const rows = [
    { ...fields, id: 1, date: '2026-02-27', weight_kg: '-1.00' },
    { ...fields, id: 2, date, weight_kg: '80.00' },
    { ...fields, id: 3, date, weight_kg: '81.00' },
    { ...fields, id: 4, date, weight_kg: null, waist_cm: '76.20' },
  ].map((row) => measurementSchema.parse(row));
  expect(measurementSeries(rows, 'weight_kg', 'metric')).toEqual([
    { date: '2026-02-27', value: -1, label: '-1.00 kg' },
    { date, value: 81, label: '81.00 kg' },
  ]);
  expect(measurementSeries(rows, 'height_cm', 'metric')).toEqual([]);
});
