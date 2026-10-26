import {
  canonicalHeight,
  canonicalWeight,
  displayHeight,
  displayWeight,
  profileDefaults,
  profileFormSchema,
} from '../profileForm';
import { completeAccount, incompleteAccount } from './fixtures';

const values = profileDefaults(completeAccount);
test.each([
  ['100', 'imperial', '45.359237'],
  ['1', 'imperial', '0.453592'],
  ['2', 'imperial', '0.907185'],
  ['70.12', 'metric', '70.120000'],
] as const)(
  'converts %s %s to canonical kg without display precision loss',
  (value, system, expected) => {
    expect(canonicalWeight(value, system)).toBe(expected);
  },
);
test('height converts feet/inches to canonical centimetres using half-up rounding', () => {
  expect(canonicalHeight({ height_cm: '', height_ft: '5', height_in: '7.25' }, 'imperial')).toBe(
    '170.82',
  );
  expect(displayHeight('170.82')).toEqual({
    height_cm: '170.82',
    height_ft: '5',
    height_in: '7.25',
  });
  expect(displayHeight('182.88')).toEqual({
    height_cm: '182.88',
    height_ft: '6',
    height_in: '0.00',
  });
  expect(displayHeight('182.87').height_in).toBe('0.00');
});
test('saved measurements always display two decimals', () => {
  expect(displayWeight('70.000000', 'imperial')).toBe('154.32');
  expect(displayWeight('70.125000', 'metric')).toBe('70.13');
  expect(profileDefaults(completeAccount).height_cm).toBe('170.00');
  expect(profileDefaults(completeAccount).weight).toBe('70.00');
});
test('profile requires an explicitly chosen measurement system', () => {
  expect(profileFormSchema.safeParse(values).success).toBe(true);
  expect(profileFormSchema.safeParse({ ...values, measurement_system: null }).success).toBe(false);
  expect(profileDefaults(incompleteAccount).measurement_system).toBeNull();
});
test.each([
  { display_name: ' ' },
  { age: '25.5' },
  { age: '121' },
  { height_cm: '301' },
  { weight: '-1' },
  { weight: 'NaN' },
  { weight: '1000.01' },
  { weight: '1.123' },
  { height_cm: '170.123' },
  { measurement_system: 'imperial', height_ft: '5', height_in: '12' },
  { measurement_system: 'imperial', height_ft: '0', height_in: '0' },
  { measurement_system: 'imperial', height_ft: '5.1', height_in: '2' },
])('rejects invalid profile input without throwing', (patch) => {
  expect(profileFormSchema.safeParse({ ...values, ...patch }).success).toBe(false);
});
