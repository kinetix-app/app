import React from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
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
    foodPage: jest.fn(),
    searchFoods: jest.fn(),
    createFood: jest.fn(),
    updateFood: jest.fn(),
    deleteFood: jest.fn(),
    recipes: jest.fn(),
    createRecipe: jest.fn(),
    updateRecipe: jest.fn(),
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
  ingredients: [{ food_id: food.id, name: food.name, quantity_grams: 100 }],
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
      <AddFoodScreen
        accountId={1}
        meal="Lunch"
        date="2026-10-28"
        onSaved={onSaved}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return { onSaved, onClose };
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.resetAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() } as unknown as ReturnType<
      typeof AccessibilityInfo.addEventListener
    >);
  jest.mocked(nutritionApi.foods).mockResolvedValue([food, { ...food, id: 3, name: 'Beans' }]);
  jest.mocked(nutritionApi.searchFoods).mockResolvedValue([food]);
  jest
    .mocked(nutritionApi.foodPage)
    .mockImplementation((term, _offset, _limit, signal) =>
      term ? nutritionApi.searchFoods(term, signal) : nutritionApi.foods(signal),
    );
  jest.mocked(nutritionApi.recipes).mockResolvedValue([recipe, { ...recipe, id: 4, name: 'Soup' }]);
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});
test('searches trimmed input, previews calories and logs rounded grams for the selected meal', async () => {
  const { onSaved, onClose } = open();
  expect(screen.queryByRole('button', { name: 'Add food' })).toBeNull();
  expect(screen.queryByLabelText('Food amount')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Search food'), ' Rice ');
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  await waitFor(() =>
    expect(nutritionApi.searchFoods).toHaveBeenCalledWith('Rice', expect.anything()),
  );
  fireEvent.press(await screen.findByLabelText('Select Rice'));
  expect(screen.getByLabelText('Food amount').props.value).toBe('');
  expect(screen.getByRole('button', { name: 'Add food' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Food amount'), '12g.5');
  expect(screen.getByLabelText('Food amount').props.value).toBe('12.5');
  fireEvent.press(screen.getByLabelText('Select Rice'));
  expect(screen.queryByLabelText('Food amount')).toBeNull();
  fireEvent.press(screen.getByLabelText('Select Rice'));
  fireEvent.changeText(screen.getByLabelText('Food amount'), '125.555');
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(screen.getByText('125.6 KCAL')).toBeVisible();
  expect(screen.queryByText('Per 100 g · 100 kcal')).toBeNull();
  expect(screen.getByText('3.8g')).toBeTruthy();
  expect(screen.getByText('25.1g')).toBeTruthy();
  expect(screen.getByText('Values per 125.555 g')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Add food' }));
  expect(nutritionApi.addMealItem).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Review 1 entry'));
  expect(screen.getByText('Review entries')).toBeTruthy();
  fireEvent.press(screen.getByText('Add 1 entry to Lunch'));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(nutritionApi.addMealItem).toHaveBeenCalledWith({
    date: '2026-10-28',
    meal_type: 'lunch',
    food_id: 1,
    quantity_grams: 125.56,
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});
test('appends another page and restarts pagination for a new search', async () => {
  const matches = Array.from({ length: 22 }, (_, index) => ({
    ...food,
    id: index + 1,
    name: `Rice ${index + 1}`,
  }));
  jest
    .mocked(nutritionApi.foodPage)
    .mockImplementation(async (term, offset, limit) =>
      term === 'rice' ? matches.slice(offset, offset + limit) : [],
    );
  open();
  const search = screen.getByLabelText('Search food');
  fireEvent.changeText(search, 'rice');
  expect(await screen.findByLabelText('Select Rice 20')).toBeVisible();
  expect(screen.queryByLabelText('Select Rice 21')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Load more foods' }));
  expect(await screen.findByLabelText('Select Rice 22')).toBeVisible();
  expect(screen.getByLabelText('Select Rice 1')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Load more foods' })).toBeNull();
  expect(nutritionApi.foodPage).toHaveBeenCalledWith('rice', 20, 21, expect.anything());
  fireEvent.changeText(search, 'beans');
  await waitFor(() =>
    expect(nutritionApi.foodPage).toHaveBeenCalledWith('beans', 0, 21, expect.anything()),
  );
  expect(screen.queryByLabelText('Select Rice 1')).toBeNull();
});
test('queues multiple foods and confirms them with separate hidden requests', async () => {
  const { onSaved, onClose } = open();
  fireEvent.press(await screen.findByLabelText('Select Rice'));
  fireEvent.changeText(screen.getByLabelText('Food amount'), '100');
  fireEvent.press(screen.getByRole('button', { name: 'Add food' }));
  expect(screen.getByLabelText('Select Rice').props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByLabelText('Select Beans'));
  fireEvent.changeText(screen.getByLabelText('Food amount'), '50');
  fireEvent.press(screen.getByRole('button', { name: 'Add food' }));
  expect(screen.getByLabelText('Select Rice').props.accessibilityState.selected).toBe(true);
  expect(screen.getByLabelText('Select Beans').props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByText('Review 2 entries'));
  expect(
    screen.getByLabelText(
      'Nutrition summary: 150 calories, 30 grams carbohydrates, 4.5 grams protein, 1.5 grams fat',
    ),
  ).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Back to selection'));
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByText('Review 2 entries')).toBeTruthy();
  fireEvent.press(screen.getByText('Review 2 entries'));
  fireEvent.press(screen.getByText('Add 2 entries to Lunch'));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(nutritionApi.addMealItem).toHaveBeenCalledTimes(2);
  expect(nutritionApi.addMealItem).toHaveBeenNthCalledWith(1, {
    date: '2026-10-28',
    meal_type: 'lunch',
    food_id: 1,
    quantity_grams: 100,
  });
  expect(nutritionApi.addMealItem).toHaveBeenNthCalledWith(2, {
    date: '2026-10-28',
    meal_type: 'lunch',
    food_id: 3,
    quantity_grams: 50,
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});
test('edits a queued food quantity from the review before adding it', async () => {
  open();
  fireEvent.press(await screen.findByLabelText('Select Rice'));
  fireEvent.changeText(screen.getByLabelText('Food amount'), '100');
  fireEvent.press(screen.getByRole('button', { name: 'Add food' }));
  fireEvent.press(screen.getByText('Review 1 entry'));
  fireEvent.press(screen.getByLabelText('Edit Rice quantity'));
  expect(screen.getByText('Values per 100 g')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Edit Rice quantity'));
  expect(screen.queryByLabelText('Food amount')).toBeNull();
  fireEvent.press(screen.getByLabelText('Edit Rice quantity'));
  expect(screen.getByLabelText('Food amount').props.value).toBe('100');
  fireEvent.changeText(screen.getByLabelText('Food amount'), '150');
  fireEvent.press(screen.getByText('Save changes'));
  expect(screen.getByText('150 g · 150 kcal')).toBeTruthy();
  fireEvent.press(screen.getByText('Add 1 entry to Lunch'));
  await waitFor(() =>
    expect(nutritionApi.addMealItem).toHaveBeenCalledWith({
      date: '2026-10-28',
      meal_type: 'lunch',
      food_id: 1,
      quantity_grams: 150,
    }),
  );
});
test('shows no search results and supports returning to the diary', async () => {
  jest.mocked(nutritionApi.searchFoods).mockResolvedValue([]);
  const { onClose } = open();
  fireEvent.changeText(screen.getByLabelText('Search food'), 'unknown');
  expect(await screen.findByText('No foods found.')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Back to nutrition'));
  expect(onClose).toHaveBeenCalledTimes(1);
});
test('shows the selected food controls before hiding the following results', async () => {
  open();
  await screen.findByLabelText('Select Rice');
  expect(screen.getByLabelText('Select Beans')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Select Rice'));
  expect(screen.queryByLabelText('Select Beans')).toBeNull();
  expect(screen.getByLabelText('Food amount')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Select Rice'));
  expect(screen.getByLabelText('Select Beans')).toBeTruthy();
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
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Add food' })).toBeNull());
  expect(nutritionApi.deleteFood).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('button', { name: 'Add food' })).toBeNull();
});
test('creates a food with a macro estimate and refreshes the catalogue', async () => {
  jest.mocked(nutritionApi.createFood).mockResolvedValue(food);
  open();
  fireEvent.press(screen.getByRole('button', { name: 'Create' }));
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
  expect(screen.getByLabelText('calories').props.value).toBe('101');
  fireEvent.press(screen.getByText('Save food'));
  await waitFor(() => expect(screen.queryByLabelText('Food name')).toBeNull());
  expect(nutritionApi.createFood).toHaveBeenCalledWith({
    name: 'Rice',
    brand: null,
    barcode: null,
    calories: 101,
    protein: 3,
    carbohydrates: 20,
    fats: 1,
  });
  expect(nutritionApi.foods).toHaveBeenCalledTimes(2);
});
test('reuses the food form with the existing values when editing', async () => {
  jest.mocked(nutritionApi.updateFood).mockResolvedValue({ ...food, name: 'Brown rice' });
  open();
  fireEvent.press(await screen.findByLabelText('Edit Rice'));
  expect(screen.getByLabelText('Food name').props.value).toBe('Rice');
  expect(screen.getByLabelText('calories').props.value).toBe('100');
  fireEvent.changeText(screen.getByLabelText('Food name'), 'Brown rice');
  fireEvent.press(screen.getByText('Save changes'));
  await waitFor(() =>
    expect(nutritionApi.updateFood).toHaveBeenCalledWith(1, {
      name: 'Brown rice',
      brand: null,
      barcode: null,
      calories: 100,
      protein: 3,
      carbohydrates: 20,
      fats: 1,
    }),
  );
  expect(screen.queryByText('Edit food')).toBeNull();
});
test('confirms foods and recipes together and retries only the entry that failed', async () => {
  jest.mocked(nutritionApi.recipes).mockResolvedValue([
    { ...recipe, id: food.id },
    { ...recipe, id: 4, name: 'Soup' },
  ]);
  jest.mocked(nutritionApi.addRecipeMealItem).mockImplementationOnce(() => {
    throw new Error('Recipe request failed');
  });
  const { onSaved, onClose } = open();
  fireEvent.press(await screen.findByLabelText('Select Rice'));
  fireEvent.changeText(screen.getByLabelText('Food amount'), '100');
  fireEvent.press(screen.getByRole('button', { name: 'Add food' }));
  fireEvent.press(screen.getByRole('tab', { name: 'Recipe' }));
  for (const name of ['Rice bowl', 'Soup']) {
    fireEvent.press(await screen.findByLabelText(`Select ${name}`));
    fireEvent.changeText(screen.getByLabelText('Recipe servings to add'), '1.5');
    fireEvent.press(screen.getByRole('button', { name: 'Add recipe' }));
  }
  expect(nutritionApi.addMealItem).not.toHaveBeenCalled();
  expect(nutritionApi.addRecipeMealItem).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Review 3 entries'));
  expect(screen.getByText('700 KCAL')).toBeVisible();
  fireEvent.press(screen.getByText('Add 3 entries to Lunch'));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Some entries could not be added/);
  expect(screen.queryByText('Rice')).toBeNull();
  expect(screen.queryByText('Soup')).toBeNull();
  expect(screen.getByText('Rice bowl')).toBeVisible();
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Edit Rice bowl quantity'));
  fireEvent.changeText(screen.getByLabelText('Recipe servings to add'), '2');
  fireEvent.press(screen.getByText('Save changes'));
  fireEvent.press(screen.getByText('Add 1 entry to Lunch'));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(onSaved).toHaveBeenCalledTimes(2);
  expect(nutritionApi.addMealItem).toHaveBeenCalledTimes(1);
  expect(nutritionApi.addRecipeMealItem).toHaveBeenCalledTimes(3);
  expect(nutritionApi.addRecipeMealItem).toHaveBeenLastCalledWith({
    date: '2026-10-28',
    meal_type: 'lunch',
    recipe_id: food.id,
    servings: 2,
  });
});
test('requires positive recipe servings and adds the chosen recipe to the diary', async () => {
  const { onSaved, onClose } = open();
  fireEvent.press(screen.getByText('Recipe'));
  expect(screen.queryByRole('button', { name: 'Add recipe' })).toBeNull();
  fireEvent.press(await screen.findByLabelText('Select Rice bowl'));
  expect(screen.getByLabelText('Recipe servings to add').props.value).toBe('');
  expect(screen.getByRole('button', { name: 'Add recipe' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Recipe servings to add'), '0');
  expect(screen.getByRole('button', { name: 'Add recipe' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Recipe servings to add'), '1.5');
  fireEvent.press(screen.getByText('Add recipe'));
  expect(nutritionApi.addRecipeMealItem).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Review 1 entry'));
  fireEvent.press(screen.getByText('Add 1 entry to Lunch'));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(nutritionApi.addRecipeMealItem).toHaveBeenCalledWith({
    date: '2026-10-28',
    meal_type: 'lunch',
    recipe_id: 2,
    servings: 1.5,
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});
test('reuses the recipe form with its ingredients when editing', async () => {
  jest.mocked(nutritionApi.updateRecipe).mockResolvedValue({ ...recipe, name: 'Brown rice bowl' });
  open();
  fireEvent.press(screen.getByText('Recipe'));
  fireEvent.press(await screen.findByLabelText('Edit Rice bowl'));
  expect(screen.getByLabelText('Recipe name').props.value).toBe('Rice bowl');
  expect(screen.getByLabelText('Recipe servings').props.value).toBe('2');
  expect(screen.getByLabelText('Rice quantity').props.value).toBe('100');
  fireEvent.changeText(screen.getByLabelText('Recipe name'), 'Brown rice bowl');
  fireEvent.changeText(screen.getByLabelText('Rice quantity'), '150');
  fireEvent.press(screen.getByText('Save changes'));
  await waitFor(() =>
    expect(nutritionApi.updateRecipe).toHaveBeenCalledWith(2, {
      name: 'Brown rice bowl',
      servings: 2,
      ingredients: [{ food_id: 1, quantity_grams: 150 }],
    }),
  );
  expect(screen.queryByText('Edit recipe')).toBeNull();
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
  expect(screen.queryByRole('button', { name: 'Add recipe' })).toBeNull();
});
test('builds a recipe from searched ingredients, edits quantities and removes unwanted ingredients', async () => {
  jest.mocked(nutritionApi.createRecipe).mockResolvedValue(recipe);
  open();
  fireEvent.press(screen.getByRole('tab', { name: 'Recipe' }));
  fireEvent.press(screen.getByRole('button', { name: 'Create' }));
  expect(screen.getByRole('button', { name: 'Create recipe' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Recipe name'), ' Rice bowl ');
  const typeSelector = within(screen.getByLabelText('Creation type'));
  fireEvent.press(typeSelector.getByRole('tab', { name: 'Food' }));
  expect(screen.getByLabelText('Food name')).toBeVisible();
  fireEvent.press(typeSelector.getByRole('tab', { name: 'Recipe' }));
  expect(screen.getByLabelText('Recipe name')).toHaveDisplayValue(' Rice bowl ');
  fireEvent.changeText(screen.getByLabelText('Search ingredient'), 'r');
  fireEvent.changeText(screen.getByLabelText('Search ingredient'), 'rice');
  expect(nutritionApi.searchFoods).not.toHaveBeenCalled();
  fireEvent.press(await screen.findByLabelText('Add Rice as an ingredient'));
  expect(screen.queryByLabelText('Ingredient search results')).toBeNull();
  expect(screen.getAllByText('100 KCAL')).toHaveLength(1);
  expect(nutritionApi.searchFoods).toHaveBeenCalledTimes(1);
  expect(nutritionApi.searchFoods).toHaveBeenCalledWith('rice', expect.anything());
  fireEvent.changeText(screen.getByLabelText('Recipe servings'), '2');
  fireEvent.changeText(screen.getByLabelText('Search ingredient'), 'rice');
  fireEvent.press(await screen.findByLabelText('Add Rice as an ingredient'));
  fireEvent.changeText(screen.getAllByLabelText('Rice quantity')[0], '150');
  fireEvent.press(screen.getAllByLabelText('Remove Rice')[1]);
  expect(screen.getByText('150 KCAL')).toBeVisible();
  expect(screen.getByText('Per serving')).toBeVisible();
  expect(screen.getByText('75 KCAL')).toBeVisible();
  expect(screen.getByText('2.25g')).toBeVisible();
  expect(screen.getByText('15g')).toBeVisible();
  expect(screen.getByText('0.75g')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Increase servings' }));
  expect(screen.getByLabelText('Recipe servings')).toHaveDisplayValue('3');
  expect(screen.getByText('50 KCAL')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Decrease servings' }));
  fireEvent.press(screen.getByRole('button', { name: 'Create recipe' }));
  await waitFor(() => expect(screen.queryByLabelText('Recipe name')).toBeNull());
  expect(nutritionApi.createRecipe).toHaveBeenCalledWith({
    name: 'Rice bowl',
    servings: 2,
    ingredients: [{ food_id: 1, quantity_grams: 150 }],
  });
});
