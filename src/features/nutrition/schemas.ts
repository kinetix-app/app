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
