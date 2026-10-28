import { apiClient } from '@/services/apiClient';
import { nutritionApi } from '../api';
import {
  foodSchema,
  foodListSchema,
  recipeSchema,
  recipeListSchema,
  mealItemSchema,
  nutritionDaySchema,
  nutritionGoalSchema,
} from '../schemas';

afterEach(() => jest.restoreAllMocks());
test('encodes food searches and passes cancellation through catalogue and diary reads', async () => {
  const get = jest.spyOn(apiClient, 'get').mockResolvedValue([]);
  const signal = new AbortController().signal;
  await nutritionApi.searchFoods(' Rice & beans ', signal);
  await nutritionApi.foods(signal);
  await nutritionApi.recipes(signal);
  await nutritionApi.day('2026-10-28', signal);
  expect(get.mock.calls).toEqual([
    ['/api/v1/foods?name=Rice%20%26%20beans', { schema: foodListSchema, signal }],
    ['/api/v1/foods', { schema: foodListSchema, signal }],
    ['/api/v1/recipes', { schema: recipeListSchema, signal }],
    ['/api/v1/nutrition/days/2026-10-28', { schema: nutritionDaySchema, signal }],
  ]);
});
test('validates recipe and logged amounts before issuing writes', async () => {
  const post = jest.spyOn(apiClient, 'post').mockResolvedValue({});
  const recipe = {
    name: ' Bowl ',
    servings: 2,
    ingredients: [{ food_id: 1, quantity_grams: 125.5 }],
  };
  await nutritionApi.createRecipe(recipe);
  expect(post).toHaveBeenLastCalledWith(
    '/api/v1/recipes',
    { ...recipe, name: 'Bowl' },
    { schema: recipeSchema },
  );
  const meal = {
    date: '2026-10-28',
    meal_type: 'snack' as const,
    food_id: 1,
    quantity_grams: 125.5,
  };
  await nutritionApi.addMealItem(meal);
  expect(post).toHaveBeenLastCalledWith('/api/v1/nutrition/meal-items', meal, {
    schema: mealItemSchema,
  });
  const recipeMeal = { date: meal.date, meal_type: meal.meal_type, recipe_id: 2, servings: 1.5 };
  await nutritionApi.addRecipeMealItem(recipeMeal);
  expect(post).toHaveBeenLastCalledWith('/api/v1/nutrition/recipe-items', recipeMeal, {
    schema: mealItemSchema,
  });
  post.mockClear();
  expect(() => nutritionApi.createRecipe({ ...recipe, ingredients: [] })).toThrow();
  expect(() => nutritionApi.addMealItem({ ...meal, quantity_grams: 0 })).toThrow();
  expect(() => nutritionApi.addRecipeMealItem({ ...recipeMeal, servings: -1 })).toThrow();
  expect(post).not.toHaveBeenCalled();
});
test('creates food and nutrition targets and preserves zero macros on updates', async () => {
  const post = jest.spyOn(apiClient, 'post').mockResolvedValue({});
  const patch = jest.spyOn(apiClient, 'patch').mockResolvedValue({});
  const food = {
    name: 'Rice',
    brand: null,
    barcode: null,
    calories: 100,
    protein: 3,
    carbohydrates: 20,
    fats: 1,
  };
  await nutritionApi.createFood(food);
  expect(post).toHaveBeenLastCalledWith('/api/v1/foods', food, { schema: foodSchema });
  const goal = { calories: 2000, protein: 100, carbohydrates: 200, fats: 0 };
  await nutritionApi.createGoal(goal);
  expect(post).toHaveBeenLastCalledWith('/api/v1/nutrition-goals', goal, {
    schema: nutritionGoalSchema,
  });
  await nutritionApi.updateGoal(goal);
  expect(patch).toHaveBeenCalledWith('/api/v1/nutrition-goals/me', goal, {
    schema: nutritionGoalSchema,
  });
});
test('deletion targets only the selected food, recipe or diary item and propagates conflicts', async () => {
  const remove = jest.spyOn(apiClient, 'delete').mockResolvedValue(undefined);
  await nutritionApi.deleteFood(1);
  await nutritionApi.deleteRecipe(2);
  await nutritionApi.deleteMealItem(3);
  expect(remove.mock.calls).toEqual([
    ['/api/v1/foods/1'],
    ['/api/v1/recipes/2'],
    ['/api/v1/nutrition/meal-items/3'],
  ]);
  remove.mockRejectedValue(new Error('conflict'));
  await expect(nutritionApi.deleteFood(1)).rejects.toThrow('conflict');
});
