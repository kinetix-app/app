import { canonicalWeight, profileDefaults, profileFormSchema } from '../profileForm';
import { completeAccount, incompleteAccount } from './fixtures';

const values = profileDefaults(completeAccount);
test.each([
  ['100', 'lb', '45.359237'],
  ['1', 'lb', '0.453592'],
  ['2', 'lb', '0.907185'],
  ['70.123456', 'kg', '70.123456'],
] as const)(
  'converts %s %s using exact half-up canonical kg precision',
  (value, unit, expected) => {
    expect(canonicalWeight(value, unit)).toBe(expected);
  },
);

test('profile requires an explicitly chosen weight unit and permits an empty picture', () => {
  expect(profileFormSchema.safeParse({ ...values, picture_url: '' }).success).toBe(true);
  expect(profileFormSchema.safeParse({ ...values, weight_unit: null }).success).toBe(false);
  expect(profileDefaults(incompleteAccount).weight_unit).toBeNull();
});

test.each([
  { display_name: ' ' },
  { age: '25.5' },
  { age: '121' },
  { height_cm: '301' },
  { weight: '-1' },
  { weight: 'NaN' },
  { weight: '1000.000001', weight_unit: 'kg' },
  { weight: '0.000001', weight_unit: 'lb' },
  { weight: '1.1234567' },
  { picture_url: 'http://example.test/image.png' },
])('rejects invalid profile input without throwing', (patch) => {
  expect(profileFormSchema.safeParse({ ...values, ...patch }).success).toBe(false);
});
