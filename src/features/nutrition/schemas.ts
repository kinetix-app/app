import { z } from 'zod/v4';

export const nutritionGoalSchema = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  user_id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  calories: z.coerce.number().nonnegative(),
  protein: z.coerce.number().nonnegative(),
  carbohydrates: z.coerce.number().nonnegative(),
  fats: z.coerce.number().nonnegative(),
});

export type NutritionGoal = z.infer<typeof nutritionGoalSchema>;

export const nutritionGoalInputSchema = z.object({
  calories: z.number().positive().max(999999.99),
  protein: z.number().nonnegative().max(999999.99),
  carbohydrates: z.number().nonnegative().max(999999.99),
  fats: z.number().nonnegative().max(999999.99),
});

export type NutritionGoalInput = z.infer<typeof nutritionGoalInputSchema>;
