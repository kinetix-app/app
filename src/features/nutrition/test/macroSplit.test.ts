import {
  hundredths,
  nutritionDraftGoal,
  macroBudget,
  convertMacroDraft,
  percentagesFromGoal,
  percentageTotal,
} from '../macroSplit';

const draft = { calories: '2000', carbohydrates: '40', protein: '30', fats: '30' };

test('manual percentages produce documented gram equivalents with half-up rounding', () => {
  const amounts = nutritionDraftGoal(draft, 'percentages');
  expect(amounts).toEqual({ calories: 2000, carbohydrates: 200, protein: 150, fats: 66.67 });
  expect(percentagesFromGoal(amounts!)).toEqual({
    carbohydrates: '40.00',
    protein: '30.00',
    fats: '30.00',
  });
  expect(
    nutritionDraftGoal(
      { calories: '0.02', carbohydrates: '100', protein: '0', fats: '0' },
      'percentages',
    )?.carbohydrates,
  ).toBe(0.01);
  expect(hundredths('0,01')).toBe(1);
});

test('fractional percentages have exact totals and accept decimal commas', () => {
  expect(percentageTotal({ carbohydrates: '33.33', protein: '33.33', fats: '33.34' })).toBe(100);
  expect(
    nutritionDraftGoal(
      { ...draft, calories: '2000,25', carbohydrates: '40,25', protein: '29.75' },
      'percentages',
    )?.calories,
  ).toBe(2000.25);
});

test.each(['', '-1', 'Infinity', 'NaN', '1e2', '20.001', ' 40', '9'.repeat(100)])(
  'rejects invalid macro input %s in both modes',
  (value) => {
    for (const mode of ['percentages', 'grams'] as const)
      expect(nutritionDraftGoal({ ...draft, carbohydrates: value }, mode)).toBeUndefined();
  },
);

test.each(['', '0', '-2', '2000.001', '1000000', 'Infinity', '1e3'])(
  'rejects invalid calories %s',
  (calories) => {
    expect(nutritionDraftGoal({ ...draft, calories }, 'percentages')).toBeUndefined();
  },
);

test('preserves zero macros and exact gram inputs rather than normalizing them', () => {
  const grams = { calories: '2400.15', carbohydrates: '250.25', protein: '150.12', fats: '0' };
  expect(nutritionDraftGoal(grams, 'grams')).toEqual({
    calories: 2400.15,
    carbohydrates: 250.25,
    protein: 150.12,
    fats: 0,
  });
  expect(
    convertMacroDraft({ ...draft, carbohydrates: '0', protein: '100', fats: '0' }, 'percentages'),
  ).toEqual({ calories: '2000', carbohydrates: '0.00', protein: '500.00', fats: '0.00' });
  expect(
    nutritionDraftGoal(
      { calories: '999999.99', carbohydrates: '0', protein: '0', fats: '100' },
      'percentages',
    )?.fats,
  ).toBe(111111.11);
});

test('reports required calories for over-budget percentages without normalizing them', () => {
  const over = { ...draft, carbohydrates: '60' };
  expect(macroBudget(over, 'percentages')).toEqual({
    requiredCalories: 2400,
    percentage: 120,
    difference: 400,
    overBudget: true,
  });
  expect(nutritionDraftGoal(over, 'percentages')).toEqual({
    calories: 2000,
    carbohydrates: 300,
    protein: 150,
    fats: 66.67,
  });
  expect(macroBudget({ ...over, carbohydrates: '150' }, 'percentages')?.requiredCalories).toBe(
    4200,
  );
  expect(macroBudget({ ...over, calories: '0.01' }, 'percentages')?.overBudget).toBe(true);
});

test('gram budgets tolerate conversion rounding but flag actual excess and show remaining calories', () => {
  const grams = { calories: '2000', carbohydrates: '200', protein: '150', fats: '66.67' };
  expect(macroBudget(grams, 'grams')?.overBudget).toBe(false);
  expect(macroBudget({ ...grams, carbohydrates: '201' }, 'grams')?.overBudget).toBe(true);
  expect(macroBudget({ ...grams, fats: '0' }, 'grams')).toEqual({
    requiredCalories: 1400,
    percentage: 70,
    difference: -600,
    overBudget: false,
  });
  expect(convertMacroDraft(grams, 'grams')).toEqual({
    calories: '2000',
    carbohydrates: '40.00',
    protein: '30.00',
    fats: '30.00',
  });
});

test('legacy shares use the stated calorie budget, with absent equivalents for zero calories', () => {
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
  expect(macroBudget({ ...draft, protein: '' }, 'percentages')).toBeUndefined();
});
