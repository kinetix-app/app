import { nutritionGoalInputSchema, type NutritionGoalInput } from './schemas';

export const macroFields = [
  ['carbohydrates', 'Carbohydrate', 4],
  ['protein', 'Protein', 4],
  ['fats', 'Fat', 9],
] as const;
export type Macro = (typeof macroFields)[number][0];
export type MacroPercentages = Record<Macro, string>;
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
    if (value === undefined || value > 10000) return undefined;
    total += value;
  }
  return total / 100;
}

/** Manual energy shares, not a scientific recommendation. Round grams half up to 0.01 g. */
export function macroSplitGoal(
  calories: string,
  percentages: MacroPercentages,
): NutritionGoalInput | undefined {
  const energy = hundredths(calories);
  if (!energy || energy > 99999999 || percentageTotal(percentages) !== 100) return undefined;
  const amounts = { calories: energy / 100, protein: 0, carbohydrates: 0, fats: 0 };
  for (const [macro, , factor] of macroFields) {
    amounts[macro] = macroGrams(calories, percentages[macro], factor)!;
  }
  const parsed = nutritionGoalInputSchema.safeParse(amounts);
  return parsed.success ? parsed.data : undefined;
}

/** Preview a single share even while the other percentages are incomplete. */
export function macroGrams(
  calories: string,
  percentage: string,
  factor: 4 | 9,
): number | undefined {
  const energy = hundredths(calories);
  const share = hundredths(percentage);
  if (!energy || energy > 99999999 || share === undefined || share > 10000) return undefined;
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
