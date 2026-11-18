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

/** Keep a percentage split at exactly 100% by adjusting one companion macro. */
export function rebalancePercentages(
  values: MacroPercentages,
  changed: Macro,
  nextValue: string,
): MacroPercentages | undefined {
  const next = hundredths(nextValue);
  if (next === undefined) return undefined;
  const macros = macroFields.map(([macro]) => macro);
  const [first, second] = macros.filter((macro) => macro !== changed);
  const changedValue = Math.min(Math.round(next / 100) * 100, 10000);
  const remaining = 10000 - changedValue;
  const firstValue = Math.round((hundredths(values[first]) ?? 0) / 100) * 100;
  const secondValue = Math.round((hundredths(values[second]) ?? 0) / 100) * 100;
  const previousTotal = firstValue + secondValue;
  const nextFirst =
    previousTotal > 0
      ? Math.round((remaining * firstValue) / previousTotal / 100) * 100
      : Math.floor(remaining / 200) * 100;
  const nextSecond = remaining - nextFirst;
  return {
    ...values,
    [changed]: String(changedValue / 100),
    [first]: String(nextFirst / 100),
    [second]: String(nextSecond / 100),
  };
}

/** Keep gram inputs within the calorie target by adjusting one companion macro. */
export function rebalanceGrams(
  values: MacroGoalValues,
  changed: Macro,
  nextValue: string,
): MacroValues | undefined {
  const calories = hundredths(values.calories);
  const next = hundredths(nextValue);
  if (!calories || next === undefined) return undefined;
  const macros = macroFields.map(([macro]) => macro);
  const [first, second] = macros.filter((macro) => macro !== changed);
  const factorFor = (macro: Macro) => macroFields.find(([field]) => field === macro)![2];
  const changedFactor = factorFor(changed);
  const changedAmount = Math.min(next, Math.floor(calories / changedFactor));
  const remainingEnergy = calories - changedAmount * changedFactor;
  const firstEnergy = (hundredths(values[first]) ?? 0) * factorFor(first);
  const secondEnergy = (hundredths(values[second]) ?? 0) * factorFor(second);
  const previousEnergy = firstEnergy + secondEnergy;
  const nextFirstEnergy =
    previousEnergy > 0
      ? Math.round((remainingEnergy * firstEnergy) / previousEnergy)
      : Math.floor(remainingEnergy / 2);
  const firstAmount = Math.min(
    Math.floor(nextFirstEnergy / factorFor(first)),
    Math.floor(remainingEnergy / factorFor(first)),
  );
  const secondAmount = Math.floor(
    Math.max(0, remainingEnergy - firstAmount * factorFor(first)) / factorFor(second),
  );
  return {
    ...values,
    [changed]: (changedAmount / 100).toFixed(2),
    [first]: (firstAmount / 100).toFixed(2),
    [second]: (secondAmount / 100).toFixed(2),
  };
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

/** Convert stored grams into an integer split that always totals 100%. */
export function percentagesFromGoal(goal: NutritionGoalInput): MacroPercentages {
  if (goal.calories <= 0) return { ...emptyPercentages };
  const carbohydrates = Math.min(Math.round((goal.carbohydrates * 4 * 100) / goal.calories), 100);
  const protein = Math.min(
    Math.round((goal.protein * 4 * 100) / goal.calories),
    100 - carbohydrates,
  );
  return {
    carbohydrates: String(carbohydrates),
    protein: String(protein),
    fats: String(100 - carbohydrates - protein),
  };
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
    converted[macro] = equivalent === undefined ? '' : equivalent.toFixed(mode === 'grams' ? 0 : 2);
  }
  if (mode === 'grams' && Object.values(converted).every((value) => value !== '')) {
    const balanced = rebalancePercentages(converted, 'fats', converted.fats);
    return balanced ? { ...converted, ...balanced } : converted;
  }
  return converted;
}
