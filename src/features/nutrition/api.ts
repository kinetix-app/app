import { apiClient } from '@/services/apiClient';

import {
  foodListSchema,
  mealItemInputSchema,
  mealItemSchema,
  nutritionGoalInputSchema,
  nutritionGoalSchema,
  type MealItemInput,
  type NutritionGoalInput,
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
  addMealItem: (input: MealItemInput) =>
    apiClient.post('/api/v1/nutrition/meal-items', mealItemInputSchema.parse(input), {
      schema: mealItemSchema,
    }),
};
