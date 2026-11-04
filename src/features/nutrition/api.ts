import { ApiError, apiClient } from '@/services/apiClient';

import {
  foodListSchema,
  foodInputSchema,
  foodSchema,
  mealItemInputSchema,
  mealItemPatchSchema,
  mealItemSchema,
  nutritionDaySchema,
  nutritionGoalInputSchema,
  nutritionGoalSchema,
  recipeInputSchema,
  recipeListSchema,
  recipeMealItemInputSchema,
  recipeSchema,
  type MealItemInput,
  type MealItemPatch,
  type FoodInput,
  type NutritionGoalInput,
  type RecipeInput,
  type RecipeMealItemInput,
} from './schemas';

export const nutritionApi = {
  goal: async (signal?: AbortSignal) => {
    try {
      return await apiClient.get('/api/v1/nutrition-goals/me', {
        schema: nutritionGoalSchema,
        signal,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
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
  updateFood: (foodId: number, input: FoodInput) =>
    apiClient.patch(`/api/v1/foods/${foodId}`, foodInputSchema.parse(input), {
      schema: foodSchema,
    }),
  createRecipe: (input: RecipeInput) =>
    apiClient.post('/api/v1/recipes', recipeInputSchema.parse(input), { schema: recipeSchema }),
  recipes: (signal?: AbortSignal) =>
    apiClient.get('/api/v1/recipes', { schema: recipeListSchema, signal }),
  searchRecipes: (name: string, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/recipes?name=${encodeURIComponent(name.trim())}`, {
      schema: recipeListSchema,
      signal,
    }),
  deleteRecipe: (recipeId: number) => apiClient.delete(`/api/v1/recipes/${recipeId}`),
  updateRecipe: (recipeId: number, input: RecipeInput) =>
    apiClient.patch(`/api/v1/recipes/${recipeId}`, recipeInputSchema.parse(input), {
      schema: recipeSchema,
    }),
  addMealItem: (input: MealItemInput) =>
    apiClient.post('/api/v1/nutrition/meal-items', mealItemInputSchema.parse(input), {
      schema: mealItemSchema,
    }),
  deleteMealItem: (mealItemId: number) =>
    apiClient.delete(`/api/v1/nutrition/meal-items/${mealItemId}`),
  updateMealItem: (mealItemId: number, input: MealItemPatch) =>
    apiClient.patch(`/api/v1/nutrition/meal-items/${mealItemId}`, mealItemPatchSchema.parse(input)),
  addRecipeMealItem: (input: RecipeMealItemInput) =>
    apiClient.post('/api/v1/nutrition/recipe-items', recipeMealItemInputSchema.parse(input), {
      schema: mealItemSchema,
    }),
  day: (date: string, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/nutrition/days/${date}`, { schema: nutritionDaySchema, signal }),
};
