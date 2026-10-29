import { hundredths, macroSplitGoal, percentagesFromGoal, percentageTotal } from '../macroSplit';

const split = { carbohydrates: '40', protein: '30', fats: '30' };

test('manual energy shares produce the documented grams with half-up rounding', () => {
  expect(macroSplitGoal('2000', split)).toEqual({
    calories: 2000,
    carbohydrates: 200,
    protein: 150,
    fats: 66.67,
  });
  expect(percentagesFromGoal(macroSplitGoal('2000', split)!)).toEqual({
    carbohydrates: '40.00',
    protein: '30.00',
    fats: '30.00',
  });
  expect(
    macroSplitGoal('0.02', { carbohydrates: '100', protein: '0', fats: '0' })?.carbohydrates,
  ).toBe(0.01);
});

test('fractional shares total exactly 100 without floating point drift', () => {
  expect(percentageTotal({ carbohydrates: '33.33', protein: '33.33', fats: '33.34' })).toBe(100);
  expect(
    macroSplitGoal('2000,25', { carbohydrates: '40,25', protein: '29.75', fats: '30' })?.calories,
  ).toBe(2000.25);
});

test.each(['', '-1', 'Infinity', 'NaN', '1e2', '20.001', '101', ' 40', '9'.repeat(100)])(
  'rejects invalid percentage input %s',
  (value) => {
    expect(macroSplitGoal('2000', { ...split, carbohydrates: value })).toBeUndefined();
  },
);

test.each(['', '0', '-2', '2000.001', '1000000', 'Infinity', '1e3'])(
  'rejects invalid calories %s',
  (calories) => {
    expect(macroSplitGoal(calories, split)).toBeUndefined();
  },
);

test('requires exactly 100 percent and supports explicitly chosen zero shares', () => {
  expect(macroSplitGoal('2000', { ...split, fats: '29.99' })).toBeUndefined();
  expect(macroSplitGoal('2000', { ...split, fats: '30.01' })).toBeUndefined();
  expect(macroSplitGoal('2000', { carbohydrates: '0', protein: '100', fats: '0' })).toEqual({
    calories: 2000,
    carbohydrates: 0,
    protein: 500,
    fats: 0,
  });
  expect(macroSplitGoal('999999.99', { carbohydrates: '0', protein: '0', fats: '100' })?.fats).toBe(
    111111.11,
  );
});

test('legacy targets are expressed against stated calories without normalization or mutation', () => {
  const legacy = { calories: 2000, carbohydrates: 100, protein: 100, fats: 0 };
  expect(percentagesFromGoal(legacy)).toEqual({
    carbohydrates: '20.00',
    protein: '20.00',
    fats: '0.00',
  });
  expect(percentageTotal(percentagesFromGoal(legacy))).toBe(40);
  expect(legacy).toEqual({ calories: 2000, carbohydrates: 100, protein: 100, fats: 0 });
  expect(percentagesFromGoal({ ...legacy, calories: 0 })).toEqual({
    carbohydrates: '',
    protein: '',
    fats: '',
  });
  expect(hundredths('0,01')).toBe(1);
});
