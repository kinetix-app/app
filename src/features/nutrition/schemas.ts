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

export const foodSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  name: z.string(),
  brand: z.string().nullable(),
  calories: z.coerce.number(),
  protein: z.coerce.number(),
  carbohydrates: z.coerce.number(),
  fats: z.coerce.number(),
  barcode: z.string().nullable(),
});
export const foodListSchema = z.array(foodSchema);
export type Food = z.infer<typeof foodSchema>;
export const mealItemSchema = z.object({
  id: z.number().int(),
  meal_type: z.string(),
  food_id: z.number().int(),
  name: z.string(),
  quantity_grams: z.coerce.number(),
  calories: z.coerce.number(),
  protein: z.coerce.number(),
  carbohydrates: z.coerce.number(),
  fats: z.coerce.number(),
});
export const mealItemInputSchema = z.object({
  date: z.string(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  food_id: z.number().int().positive(),
  quantity_grams: z.number().positive().max(999999.99),
});
export type MealItemInput = z.infer<typeof mealItemInputSchema>;
