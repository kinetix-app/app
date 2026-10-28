import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { nutritionApi } from '../api';
import { AddFoodScreen } from '../components/AddFoodScreen';
import type { Food, Recipe } from '../schemas';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('@expo/vector-icons', () => ({ Feather: 'Icon' }));
jest.mock('../api', () => ({
  nutritionApi: {
    foods: jest.fn(),
    searchFoods: jest.fn(),
    createFood: jest.fn(),
    deleteFood: jest.fn(),
    recipes: jest.fn(),
    createRecipe: jest.fn(),
    deleteRecipe: jest.fn(),
    addMealItem: jest.fn(),
    addRecipeMealItem: jest.fn(),
  },
}));
const food: Food = {
  id: 1,
  user_id: 1,
  name: 'Rice',
  brand: null,
  barcode: null,
  calories: 100,
  protein: 3,
  carbohydrates: 20,
  fats: 1,
};
const recipe: Recipe = {
  id: 2,
  user_id: 1,
  name: 'Rice bowl',
  servings: 2,
  calories: 200,
  protein: 6,
  carbohydrates: 40,
  fats: 2,
};
function open() {
  const onSaved = jest.fn();
  const onClose = jest.fn();
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <AddFoodScreen meal="Lunch" date="2026-10-28" onSaved={onSaved} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onSaved, onClose };
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.resetAllMocks();
  jest.mocked(nutritionApi.foods).mockResolvedValue([food, { ...food, id: 3, name: 'Beans' }]);
  jest.mocked(nutritionApi.searchFoods).mockResolvedValue([food]);
  jest.mocked(nutritionApi.recipes).mockResolvedValue([recipe, { ...recipe, id: 4, name: 'Soup' }]);
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});
test('searches trimmed input, previews calories and logs rounded grams for the selected meal', async () => {
  const { onSaved, onClose } = open();
  expect(screen.getByRole('button', { name: 'Add to Lunch' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Search food'), ' Rice ');
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  await waitFor(() =>
    expect(nutritionApi.searchFoods).toHaveBeenCalledWith('Rice', expect.anything()),
  );
  fireEvent.press(await screen.findByLabelText('Select Rice'));
  fireEvent.changeText(screen.getByLabelText('Food amount'), '125.555');
  expect(screen.getByText('Total: 126 kcal')).toBeTruthy();
  fireEvent.press(screen.getByText('Add to Lunch'));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(nutritionApi.addMealItem).toHaveBeenCalledWith({
    date: '2026-10-28',
    meal_type: 'lunch',
    food_id: 1,
    quantity_grams: 125.56,
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});
test('shows no search results and supports returning to the diary', async () => {
  jest.mocked(nutritionApi.searchFoods).mockResolvedValue([]);
  const { onClose } = open();
  fireEvent.changeText(screen.getByLabelText('Search food'), 'unknown');
  expect(await screen.findByText('No foods found.')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Back to nutrition'));
  expect(onClose).toHaveBeenCalledTimes(1);
});
test('cancels deletion, explains a referenced food failure, then removes a selected food', async () => {
  jest
    .mocked(nutritionApi.deleteFood)
    .mockRejectedValueOnce(new Error('conflict'))
    .mockResolvedValueOnce(undefined);
  open();
  fireEvent.press(await screen.findByLabelText('Select Rice'));
  fireEvent.press(screen.getByLabelText('Delete Rice'));
  fireEvent.press(screen.getByText('Cancel'));
  expect(nutritionApi.deleteFood).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Delete Rice'));
  fireEvent.press(screen.getByText('Delete'));
  expect(await screen.findByText('Can’t delete food')).toBeTruthy();
  fireEvent.press(screen.getByText('Close'));
  jest.mocked(nutritionApi.foods).mockResolvedValue([]);
  fireEvent.press(screen.getByLabelText('Delete Rice'));
  fireEvent.press(screen.getByText('Delete'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add to Lunch' })).toBeDisabled());
  expect(nutritionApi.deleteFood).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: 'Add to Lunch' })).toBeDisabled();
});
test('creates a food with a macro estimate and refreshes the catalogue', async () => {
  jest.mocked(nutritionApi.createFood).mockResolvedValue(food);
  open();
  fireEvent.press(screen.getByText('New food'));
  expect(screen.getByRole('button', { name: 'Save food' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Food name'), ' Rice ');
  for (const [field, value] of Object.entries({
    calories: '100',
    protein: '3',
    carbohydrates: '20',
    fats: '1',
  })) {
    fireEvent.changeText(screen.getByLabelText(field), value);
  }
  expect(screen.getByText('Macro estimate: 101 kcal per 100 g')).toBeTruthy();
  fireEvent.press(screen.getByText('Save food'));
  await waitFor(() => expect(screen.queryByLabelText('Food name')).toBeNull());
  expect(nutritionApi.createFood).toHaveBeenCalledWith({
    name: 'Rice',
    brand: null,
    barcode: null,
    calories: 100,
    protein: 3,
    carbohydrates: 20,
    fats: 1,
  });
  expect(nutritionApi.foods).toHaveBeenCalledTimes(2);
});
test('requires positive recipe servings and adds the chosen recipe to the diary', async () => {
  const { onSaved, onClose } = open();
  fireEvent.press(screen.getByText('Recipe'));
  fireEvent.press(await screen.findByLabelText('Select Rice bowl'));
  fireEvent.changeText(screen.getByLabelText('Recipe servings to add'), '0');
  expect(screen.getByRole('button', { name: 'Add to Lunch' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Recipe servings to add'), '1.5');
  fireEvent.press(screen.getByText('Add to Lunch'));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(nutritionApi.addRecipeMealItem).toHaveBeenCalledWith({
    date: '2026-10-28',
    meal_type: 'lunch',
    recipe_id: 2,
    servings: 1.5,
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});
test('recipe deletion can be cancelled, preserves referenced history and clears removed selection', async () => {
  jest
    .mocked(nutritionApi.deleteRecipe)
    .mockRejectedValueOnce(new Error('conflict'))
    .mockResolvedValueOnce(undefined);
  open();
  fireEvent.press(screen.getByText('Recipe'));
  fireEvent.press(await screen.findByLabelText('Select Rice bowl'));
  fireEvent.press(screen.getByLabelText('Delete Rice bowl'));
  fireEvent.press(screen.getByText('Cancel'));
  expect(nutritionApi.deleteRecipe).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Delete Rice bowl'));
  fireEvent.press(screen.getByText('Delete'));
  expect(await screen.findByText('Can’t delete recipe')).toBeTruthy();
  fireEvent.press(screen.getByText('Close'));
  jest.mocked(nutritionApi.recipes).mockResolvedValue([]);
  fireEvent.press(screen.getByLabelText('Delete Rice bowl'));
  fireEvent.press(screen.getByText('Delete'));
  expect(await screen.findByText('No recipes saved yet')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add to Lunch' })).toBeDisabled();
});
test('builds a recipe from searched ingredients, edits quantities and removes unwanted ingredients', async () => {
  jest.mocked(nutritionApi.createRecipe).mockResolvedValue(recipe);
  open();
  fireEvent.press(screen.getByText('Recipe'));
  fireEvent.press(screen.getByText('New recipe'));
  expect(screen.getByRole('button', { name: 'Create recipe' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Recipe name'), ' Rice bowl ');
  fireEvent.changeText(screen.getByLabelText('Recipe servings'), '2');
  fireEvent.changeText(screen.getByLabelText('Search ingredient'), 'rice');
  fireEvent.press(await screen.findByLabelText('Add Rice as an ingredient'));
  fireEvent.changeText(screen.getByLabelText('Search ingredient'), 'rice');
  fireEvent.press(await screen.findByLabelText('Add Rice as an ingredient'));
  fireEvent.changeText(screen.getAllByLabelText('Rice quantity')[0], '150');
  fireEvent.press(screen.getAllByLabelText('Remove Rice')[1]);
  fireEvent.press(screen.getByRole('button', { name: 'Create recipe' }));
  await waitFor(() => expect(screen.queryByLabelText('Recipe name')).toBeNull());
  expect(nutritionApi.createRecipe).toHaveBeenCalledWith({
    name: 'Rice bowl',
    servings: 2,
    ingredients: [{ food_id: 1, quantity_grams: 150 }],
  });
});
