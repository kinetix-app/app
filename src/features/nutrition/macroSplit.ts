import { nutritionGoalInputSchema, type NutritionGoalInput } from './schemas';

export const macroFields = [
  ['carbohydrates', 'Carbohydrate', 4],
  ['protein', 'Protein', 4],
  ['fats', 'Fat', 9],
] as const;
export type Macro = (typeof macroFields)[number][0];
export type MacroValues = Record<Macro, string>;
export type MacroPercentages = MacroValues;
export type MacroGoalValues = MacroPercentages & { calories: string };
export const emptyPercentages: MacroPercentages = { carbohydrates: '', protein: '', fats: '' };

/** Parse nonnegative decimal input into integer hundredths; reject extra precision. */
export function hundredths(value: string): number | undefined {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) return undefined;
  const [whole, fraction = ''] = value.replace(',', '.').split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(result) ? result : undefined;
}

export function percentageTotal(percentages: MacroPercentages): number | undefined {
  let total = 0;
  for (const [macro] of macroFields) {
    const value = hundredths(percentages[macro]);
    if (value === undefined) return undefined;
    total += value;
  }
  return total / 100;
}

/** Preview a single share even while the other percentages are incomplete. */
export function macroGrams(
  calories: string,
  percentage: string,
  factor: 4 | 9,
): number | undefined {
  const energy = hundredths(calories);
  const share = hundredths(percentage);
  if (!energy || energy > 99999999 || share === undefined || !Number.isSafeInteger(energy * share))
    return undefined;
  const divisor = 10000 * factor;
  return Math.floor((energy * share + divisor / 2) / divisor) / 100;
}

/** Show each share of stated calories independently; never normalize legacy targets. */
export function percentagesFromGoal(goal: NutritionGoalInput): MacroPercentages {
  if (goal.calories <= 0) return { ...emptyPercentages };
  return {
    carbohydrates: energyShare(goal.carbohydrates, 4, goal.calories),
    protein: energyShare(goal.protein, 4, goal.calories),
    fats: energyShare(goal.fats, 9, goal.calories),
  };
}

function energyShare(grams: number, factor: number, calories: number): string {
  return (Math.round((grams * factor * 10000) / calories) / 100).toFixed(2);
}

export type MacroMode = 'percentages' | 'grams';

/** Convert a manual draft without normalizing its energy distribution. */
export function nutritionDraftGoal(
  values: MacroGoalValues,
  mode: MacroMode,
): NutritionGoalInput | undefined {
  const energy = hundredths(values.calories);
  if (!energy || energy > 99999999) return undefined;
  const result: NutritionGoalInput = {
    calories: energy / 100,
    carbohydrates: 0,
    protein: 0,
    fats: 0,
  };
  for (const [macro, , factor] of macroFields) {
    const value = hundredths(values[macro]);
    if (value === undefined || value > 99999999) return undefined;
    const grams =
      mode === 'grams' ? value / 100 : macroGrams(values.calories, values[macro], factor);
    if (grams === undefined) return undefined;
    result[macro] = grams;
  }
  const parsed = nutritionGoalInputSchema.safeParse(result);
  return parsed.success ? parsed.data : undefined;
}

/** Budget preview uses entered shares in percentage mode and exact gram energy in gram mode. */
export function macroBudget(values: MacroGoalValues, mode: MacroMode) {
  const energy = hundredths(values.calories);
  if (!energy || energy > 99999999) return undefined;
  let numerator = 0;
  let shares = 0;
  for (const [macro, , factor] of macroFields) {
    const amount = hundredths(values[macro]);
    if (amount === undefined || amount > 99999999) return undefined;
    const contribution = mode === 'grams' ? amount * factor * 10000 : energy * amount;
    if (!Number.isSafeInteger(contribution)) return undefined;
    numerator += contribution;
    shares += amount;
  }
  if (!Number.isSafeInteger(numerator)) return undefined;
  const required = Math.floor((numerator + 5000) / 10000);
  const excess = required - energy;
  // Three gram amounts rounded to 0.01 g introduce at most 0.085 kcal of energy drift.
  const overBudget = mode === 'percentages' ? shares > 10000 : excess > 9;
  return {
    requiredCalories: required / 100,
    percentage:
      mode === 'percentages' ? shares / 100 : Math.round((required * 10000) / energy) / 100,
    difference: excess / 100,
    overBudget,
  };
}

export function convertMacroDraft(values: MacroGoalValues, mode: MacroMode): MacroGoalValues {
  const converted: MacroGoalValues = { calories: values.calories, ...emptyPercentages };
  const energy = hundredths(values.calories);
  for (const [macro, , factor] of macroFields) {
    const amount = hundredths(values[macro]);
    if (amount === undefined || !energy || energy > 99999999) continue;
    const equivalent =
      mode === 'percentages'
        ? macroGrams(values.calories, values[macro], factor)
        : Math.round((amount * factor * 10000) / energy) / 100;
    converted[macro] = equivalent === undefined ? '' : equivalent.toFixed(2);
  }
  return converted;
}
