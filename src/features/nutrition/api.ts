import { apiClient } from '@/services/apiClient';

import {
  foodListSchema,
  foodInputSchema,
  foodSchema,
  mealItemInputSchema,
  mealItemSchema,
  nutritionDaySchema,
  nutritionGoalInputSchema,
  nutritionGoalSchema,
  recipeInputSchema,
  recipeListSchema,
  recipeMealItemInputSchema,
  recipeSchema,
  type MealItemInput,
  type FoodInput,
  type NutritionGoalInput,
  type RecipeInput,
  type RecipeMealItemInput,
} from './schemas';

export const nutritionApi = {
  goal: (signal?: AbortSignal) =>
    apiClient.get('/api/v1/nutrition-goals/me', { schema: nutritionGoalSchema, signal }),
  createGoal: (input: NutritionGoalInput) =>
    apiClient.post('/api/v1/nutrition-goals', nutritionGoalInputSchema.parse(input), {
      schema: nutritionGoalSchema,
    }),
  updateGoal: (input: NutritionGoalInput) =>
    apiClient.patch('/api/v1/nutrition-goals/me', nutritionGoalInputSchema.parse(input), {
      schema: nutritionGoalSchema,
    }),
  searchFoods: (name: string, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/foods?name=${encodeURIComponent(name.trim())}`, {
      schema: foodListSchema,
      signal,
    }),
  foods: (signal?: AbortSignal) =>
    apiClient.get('/api/v1/foods', { schema: foodListSchema, signal }),
  createFood: (input: FoodInput) =>
    apiClient.post('/api/v1/foods', foodInputSchema.parse(input), { schema: foodSchema }),
  deleteFood: (foodId: number) => apiClient.delete(`/api/v1/foods/${foodId}`),
  createRecipe: (input: RecipeInput) =>
    apiClient.post('/api/v1/recipes', recipeInputSchema.parse(input), { schema: recipeSchema }),
  recipes: (signal?: AbortSignal) =>
    apiClient.get('/api/v1/recipes', { schema: recipeListSchema, signal }),
  deleteRecipe: (recipeId: number) => apiClient.delete(`/api/v1/recipes/${recipeId}`),
  addMealItem: (input: MealItemInput) =>
    apiClient.post('/api/v1/nutrition/meal-items', mealItemInputSchema.parse(input), {
      schema: mealItemSchema,
    }),
  deleteMealItem: (mealItemId: number) =>
    apiClient.delete(`/api/v1/nutrition/meal-items/${mealItemId}`),
  addRecipeMealItem: (input: RecipeMealItemInput) =>
    apiClient.post('/api/v1/nutrition/recipe-items', recipeMealItemInputSchema.parse(input), {
      schema: mealItemSchema,
    }),
  day: (date: string, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/nutrition/days/${date}`, { schema: nutritionDaySchema, signal }),
};
