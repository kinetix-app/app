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
export const recipeSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  name: z.string(),
  servings: z.number().int().positive(),
  calories: z.coerce.number(),
  protein: z.coerce.number(),
  carbohydrates: z.coerce.number(),
  fats: z.coerce.number(),
});
export const recipeListSchema = z.array(recipeSchema);
export type Recipe = z.infer<typeof recipeSchema>;
export const recipeInputSchema = z.object({
  name: z.string().trim().min(1).max(150),
  servings: z.number().int().positive().max(100),
  ingredients: z
    .array(
      z.object({
        food_id: z.number().int().positive(),
        quantity_grams: z.number().positive().max(999999.99),
      }),
    )
    .min(1),
});
export type RecipeInput = z.infer<typeof recipeInputSchema>;
export const mealItemSchema = z.object({
  id: z.number().int(),
  meal_type: z.string(),
  food_id: z.number().int().nullable().optional(),
  recipe_id: z.number().int().nullable().optional(),
  name: z.string(),
  quantity_grams: z.coerce.number().nullable().optional(),
  servings: z.coerce.number().nullable().optional(),
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
export const recipeMealItemInputSchema = z.object({
  date: z.string(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  recipe_id: z.number().int().positive(),
  servings: z.number().positive().max(999999.99),
});
export type RecipeMealItemInput = z.infer<typeof recipeMealItemInputSchema>;
export const nutritionDaySchema = z.object({
  date: z.string(),
  calories: z.coerce.number(),
  protein: z.coerce.number(),
  carbohydrates: z.coerce.number(),
  fats: z.coerce.number(),
  items: z.array(mealItemSchema),
});
