import React from 'react';
import { AccessibilityInfo, FlatList } from 'react-native';
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
import { LanguageProvider } from '@/i18n/Language';
import { nutritionApi } from '../api';
import { AddFoodScreen } from '../components/AddFoodScreen';
import type { Food, Recipe } from '../schemas';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('@expo/vector-icons', () => ({ Feather: 'Icon' }));
jest.mock('../api', () => ({
  nutritionApi: {
    foodPage: jest.fn(),
    food: jest.fn(),
    createFood: jest.fn(),
    updateFood: jest.fn(),
    deleteFood: jest.fn(),
    recipePage: jest.fn(),
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
function open(language: 'en' | 'es' = 'en') {
  const onSaved = jest.fn();
  const onClose = jest.fn();
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  render(
    <LanguageProvider language={language}>
      <QueryClientProvider client={client}>
        <AddFoodScreen
          accountId={1}
          meal="Lunch"
          date="2026-10-28"
          onSaved={onSaved}
          onClose={onClose}
        />
      </QueryClientProvider>
    </LanguageProvider>,
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
  jest
    .mocked(nutritionApi.foodPage)
    .mockImplementation(async (term) =>
      term ? [food] : [food, { ...food, id: 3, name: 'Beans' }],
    );
  jest.mocked(nutritionApi.food).mockResolvedValue(food);
  jest
    .mocked(nutritionApi.recipePage)
    .mockResolvedValue([recipe, { ...recipe, id: 4, name: 'Soup' }]);
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
    expect(nutritionApi.foodPage).toHaveBeenCalledWith('Rice', 0, 21, expect.anything()),
  );
  fireEvent.press(await screen.findByLabelText('Select Rice'));
  expect(screen.getByLabelText('Food amount').props.value).toBe('');
  expect(screen.getByRole('button', { name: 'Add food' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Food amount'), '12g.5');
  expect(screen.getByLabelText('Food amount').props.value).toBe('12.5');
  fireEvent.press(screen.getByLabelText('Close amount selector'));
  expect(screen.queryByLabelText('Food amount')).toBeNull();
  fireEvent.press(screen.getByLabelText('Select Rice'));
  expect(screen.getByLabelText('Food amount')).toHaveDisplayValue('');
  fireEvent.changeText(screen.getByLabelText('Food amount'), '125.555');
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(screen.getByText('125.6 kcal')).toBeVisible();
  expect(screen.queryByText('Per 100 g · 100 kcal')).toBeNull();
  expect(screen.getByText('Protein')).toBeVisible();
  expect(screen.getByText('Carbs')).toBeVisible();
  expect(screen.getByText('Fat')).toBeVisible();
  expect(screen.getByText('3.8 g')).toBeVisible();
  expect(screen.getByText('25.1 g')).toBeVisible();
  expect(screen.getByText('For 125.555 g')).toBeVisible();
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
test('retries a failed page, appends results, and starts a new search at the first page', async () => {
  const matches = Array.from({ length: 22 }, (_, index) => ({
    ...food,
    id: index + 1,
    name: `Rice ${index + 1}`,
  }));
  let rejectNextPage = true;
  jest.mocked(nutritionApi.foodPage).mockImplementation(async (term, offset, limit) => {
    if (term === 'rice' && offset === 20 && rejectNextPage) {
      rejectNextPage = false;
      throw new Error('Page temporarily unavailable');
    }
    const results =
      term === 'rice'
        ? matches
        : matches.map((item, index) => ({ ...item, name: `Beans ${index + 1}` }));
    return results.slice(offset, offset + limit);
  });
  open();
  const search = screen.getByLabelText('Search food');
  fireEvent.changeText(search, 'rice');
  expect(await screen.findByLabelText('Select Rice 20')).toBeVisible();
  expect(screen.queryByLabelText('Select Rice 21')).toBeNull();
  fireEvent(screen.getByTestId('food-catalogue'), 'onEndReached');
  const retry = await screen.findByRole('button', { name: 'Retry loading foods' });
  expect(screen.getByLabelText('Select Rice 1')).toBeVisible();
  fireEvent.press(retry);
  await waitFor(() => {
    const list = screen
      .UNSAFE_getAllByType(FlatList)
      .find(({ props }) => props.testID === 'food-catalogue');
    expect(list?.props.data).toEqual(matches);
  });
  expect(screen.getByLabelText('Select Rice 1')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Retry loading foods' })).toBeNull();
  expect(nutritionApi.foodPage).toHaveBeenNthCalledWith(2, 'rice', 0, 21, expect.anything());
  expect(nutritionApi.foodPage).toHaveBeenNthCalledWith(3, 'rice', 20, 21, expect.anything());
  expect(nutritionApi.foodPage).toHaveBeenNthCalledWith(4, 'rice', 20, 21, expect.anything());
  fireEvent.changeText(search, 'beans');
  expect(await screen.findByLabelText('Select Beans 20')).toBeVisible();
  expect(screen.queryByLabelText('Select Beans 21')).toBeNull();
  expect(screen.queryByLabelText('Select Rice 1')).toBeNull();
  expect(nutritionApi.foodPage).toHaveBeenLastCalledWith('beans', 0, 21, expect.anything());
});
test('loads the next recipe page on scroll and starts searches at offset zero', async () => {
  const matches = Array.from({ length: 22 }, (_, index) => ({
    ...recipe,
    id: index + 1,
    name: `Bowl ${index + 1}`,
  }));
  jest
    .mocked(nutritionApi.recipePage)
    .mockImplementation(async (term, offset, limit) =>
      (term ? matches.filter(({ name }) => name === term) : matches).slice(offset, offset + limit),
    );
  open();
  fireEvent.press(screen.getByRole('tab', { name: 'Recipe' }));
  expect(await screen.findByLabelText('Select Bowl 20')).toBeVisible();
  expect(screen.queryByLabelText('Select Bowl 21')).toBeNull();
  fireEvent(screen.getByTestId('recipe-catalogue'), 'onEndReached');
  await waitFor(() => {
    const list = screen
      .UNSAFE_getAllByType(FlatList)
      .find(({ props }) => props.testID === 'recipe-catalogue');
    expect(list?.props.data).toEqual(matches);
  });
  expect(nutritionApi.recipePage).toHaveBeenLastCalledWith('', 20, 21, expect.anything());
  fireEvent.changeText(screen.getByLabelText('Search recipe'), 'Bowl 22');
  await waitFor(() => {
    expect(nutritionApi.recipePage).toHaveBeenLastCalledWith('Bowl 22', 0, 21, expect.anything());
  });
  expect(await screen.findByLabelText('Select Bowl 22')).toBeVisible();
  expect(screen.queryByLabelText('Select Bowl 1')).toBeNull();
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
  expect(screen.getByText('Review entries')).toBeVisible();
  expect(screen.queryByRole('button', { name: /^Back$/ })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Edit Rice quantity' }));
  expect(screen.getByRole('button', { name: 'Edit Beans quantity' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Add 2 entries to Lunch' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Cancel editing Rice quantity' }));
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
  expect(screen.getByText('100 g · 100 kcal')).toBeVisible();
  fireEvent.press(screen.getByLabelText('Cancel editing Rice quantity'));
  expect(screen.queryByLabelText('Food amount')).toBeNull();
  fireEvent.press(screen.getByLabelText('Edit Rice quantity'));
  expect(screen.getByLabelText('Food amount').props.value).toBe('100');
  fireEvent.changeText(screen.getByLabelText('Food amount'), '0');
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Food amount'), '150');
  expect(screen.getByText('For 150 g')).toBeVisible();
  expect(screen.getByText('4.5 g')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
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
  jest.mocked(nutritionApi.foodPage).mockResolvedValue([]);
  const { onClose } = open();
  fireEvent.changeText(screen.getByLabelText('Search food'), 'unknown');
  expect(await screen.findByText('No foods found.')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Back to nutrition'));
  expect(onClose).toHaveBeenCalledTimes(1);
});
test('opens a food amount modal while keeping all catalogue rows mounted', async () => {
  open();
  fireEvent.press(await screen.findByLabelText('Select Rice'));
  expect(screen.getByLabelText('Food amount')).toBeVisible();
  expect(screen.queryByLabelText('Select Beans')).toBeNull();
  expect(screen.getByLabelText('Select Beans', { includeHiddenElements: true })).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Close amount selector'));
  expect(screen.getByLabelText('Select Beans')).toBeVisible();
  expect(screen.queryByText('Review 1 entry')).toBeNull();
});
test('cancels deletion, explains a referenced food failure, then removes a selected food', async () => {
  jest
    .mocked(nutritionApi.deleteFood)
    .mockRejectedValueOnce(new Error('conflict'))
    .mockResolvedValueOnce(undefined);
  open();
  fireEvent.press(await screen.findByLabelText('Delete Rice'));
  fireEvent.press(screen.getByText('Cancel'));
  expect(nutritionApi.deleteFood).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Delete Rice'));
  fireEvent.press(screen.getByText('Delete'));
  expect(await screen.findByText('Can’t delete food')).toBeTruthy();
  fireEvent.press(screen.getByText('Close'));
  jest.mocked(nutritionApi.foodPage).mockResolvedValue([]);
  fireEvent.press(screen.getByLabelText('Delete Rice'));
  fireEvent.press(screen.getByText('Delete'));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Add food' })).toBeNull());
  expect(nutritionApi.deleteFood).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('button', { name: 'Add food' })).toBeNull();
});
test('creates a food with a macro estimate and refreshes the catalogue', async () => {
  jest.useRealTimers();
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
  await waitFor(() => expect(nutritionApi.createFood).toHaveBeenCalled(), { timeout: 5000 });
  await waitFor(() => expect(screen.queryByLabelText('Food name')).toBeNull(), { timeout: 5000 });
  expect(nutritionApi.createFood).toHaveBeenCalledWith({
    name: 'Rice',
    brand: null,
    barcode: null,
    calories: 101,
    protein: 3,
    carbohydrates: 20,
    fats: 1,
  });
  expect(nutritionApi.foodPage).toHaveBeenCalledTimes(2);
}, 20000);

test('keeps Spanish food form values after a failed save and allows retry', async () => {
  jest.useRealTimers();
  jest
    .mocked(nutritionApi.createFood)
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(food);
  open('es');

  fireEvent.press(screen.getByRole('button', { name: 'Crear' }));
  fireEvent.changeText(screen.getByLabelText('Nombre del alimento'), ' Yogur ');
  for (const [field, value] of Object.entries({
    Calorías: '120',
    Proteínas: '8',
    Carbohidratos: '10',
    Grasas: '4',
  })) {
    fireEvent.changeText(screen.getByLabelText(field), value);
  }

  fireEvent.press(screen.getByText('Guardar alimento'));
  expect(await screen.findByText('No se pudo guardar el alimento.')).toBeTruthy();
  expect(screen.getByLabelText('Nombre del alimento').props.value).toBe(' Yogur ');
  expect(screen.getByLabelText('Proteínas').props.value).toBe('8');

  fireEvent.press(screen.getByText('Guardar alimento'));
  await waitFor(() => expect(nutritionApi.createFood).toHaveBeenCalledTimes(2));
  expect(nutritionApi.createFood).toHaveBeenLastCalledWith({
    name: 'Yogur',
    brand: null,
    barcode: null,
    calories: 108,
    protein: 8,
    carbohydrates: 10,
    fats: 4,
  });
}, 20000);

test('keeps Spanish recipe ingredients after save failure and retries the request', async () => {
  jest.useRealTimers();
  jest
    .mocked(nutritionApi.createRecipe)
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(recipe);
  open('es');

  fireEvent.press(screen.getByRole('tab', { name: 'Recetas' }));
  fireEvent.press(screen.getByRole('button', { name: 'Crear' }));
  fireEvent.changeText(screen.getByLabelText('Nombre de la receta'), ' Bol de arroz ');
  fireEvent.changeText(screen.getByLabelText('Buscar ingrediente'), 'rice');
  fireEvent.press(await screen.findByLabelText('Añadir Rice como ingrediente'));

  fireEvent.press(screen.getAllByText('Crear receta').at(-1)!);
  expect(await screen.findByText('No se pudo guardar la receta.')).toBeTruthy();
  expect(screen.getByLabelText('Nombre de la receta').props.value).toBe(' Bol de arroz ');
  expect(screen.getByLabelText('Cantidad de Rice').props.value).toBe('100');

  fireEvent.press(screen.getAllByText('Crear receta').at(-1)!);
  await waitFor(() => expect(nutritionApi.createRecipe).toHaveBeenCalledTimes(2));
  expect(nutritionApi.createRecipe).toHaveBeenLastCalledWith({
    name: 'Bol de arroz',
    servings: 1,
    ingredients: [{ food_id: 1, quantity_grams: 100 }],
  });
}, 20000);

test('reuses the food form with the existing values when editing', async () => {
  jest.mocked(nutritionApi.updateFood).mockResolvedValue({ ...food, name: 'Brown rice' });
  open();
  fireEvent.press(await screen.findByLabelText('Edit Rice'));
  expect(screen.getByLabelText('Close editor')).toBeVisible();
  expect(screen.queryByLabelText('Search food')).toBeNull();
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
  jest.mocked(nutritionApi.recipePage).mockResolvedValue([
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
  fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
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
  expect(screen.getByLabelText('Recipe servings to add')).toHaveDisplayValue('1');
  expect(screen.getByText('Per serving', { exact: true })).toBeVisible();
  expect(screen.getByText('200 kcal', { exact: true })).toBeVisible();
  expect(screen.getByText('Add', { exact: true })).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Add recipe' }));
  fireEvent.press(screen.getByText('Review 1 entry'));
  expect(screen.getByText('1 serving · 200 kcal')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Back to selection' }));
  fireEvent.press(screen.getByRole('button', { name: 'Select Rice bowl' }));
  fireEvent.changeText(screen.getByLabelText('Recipe servings to add'), '0');
  expect(screen.getByRole('button', { name: 'Add recipe' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Increase servings' }));
  expect(screen.getByLabelText('Recipe servings to add')).toHaveDisplayValue('1');
  fireEvent.changeText(screen.getByLabelText('Recipe servings to add'), '0.5');
  fireEvent.press(screen.getByRole('button', { name: 'Increase servings' }));
  expect(screen.getByLabelText('Recipe servings to add')).toHaveDisplayValue('1.5');
  expect(screen.getByText('For 1.5 servings')).toBeVisible();
  expect(screen.getByText('300 kcal', { exact: true })).toBeVisible();
  for (const value of ['60 g', '9 g', '3 g']) expect(screen.getByText(value)).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Add recipe' }));
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
  expect(screen.getByLabelText('Close editor')).toBeVisible();
  expect(screen.queryByLabelText('Search recipe')).toBeNull();
  expect(screen.getByLabelText('Recipe name').props.value).toBe('Rice bowl');
  expect(screen.getByLabelText('Recipe servings').props.value).toBe('2');
  expect(screen.getByLabelText('Rice quantity').props.value).toBe('100');
  expect(screen.getByText('200 kcal', { exact: true })).toBeVisible();
  fireEvent.changeText(screen.getByLabelText('Recipe name'), 'Brown rice bowl');
  fireEvent.changeText(screen.getByLabelText('Rice quantity'), '150');
  expect(await screen.findByText('75 kcal', { exact: true })).toBeVisible();
  expect(nutritionApi.food).toHaveBeenCalledWith(1, expect.anything());
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
test('recipe deletion can be cancelled and preserves referenced history', async () => {
  jest
    .mocked(nutritionApi.deleteRecipe)
    .mockRejectedValueOnce(new Error('conflict'))
    .mockResolvedValueOnce(undefined);
  open();
  fireEvent.press(screen.getByText('Recipe'));
  fireEvent.press(await screen.findByLabelText('Delete Rice bowl'));
  fireEvent.press(screen.getByText('Cancel'));
  expect(nutritionApi.deleteRecipe).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Delete Rice bowl'));
  fireEvent.press(screen.getByText('Delete'));
  expect(await screen.findByText('Can’t delete recipe')).toBeTruthy();
  fireEvent.press(screen.getByText('Close'));
  jest.mocked(nutritionApi.recipePage).mockResolvedValue([]);
  fireEvent.press(screen.getByLabelText('Delete Rice bowl'));
  fireEvent.press(screen.getByText('Delete'));
  expect(await screen.findByText('No recipes saved yet')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Add recipe' })).toBeNull();
});
test('builds a recipe from searched ingredients, edits quantities and removes unwanted ingredients', async () => {
  jest.useRealTimers();
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
  expect(nutritionApi.foodPage).toHaveBeenCalledTimes(1);
  expect(nutritionApi.foodPage).toHaveBeenLastCalledWith('', 0, 21, expect.anything());
  fireEvent.press(await screen.findByLabelText('Add Rice as an ingredient'));
  expect(screen.queryByLabelText('Ingredient search results')).toBeNull();
  expect(screen.getAllByText('100 kcal', { exact: true })).toHaveLength(2);
  expect(nutritionApi.foodPage).toHaveBeenCalledTimes(2);
  expect(nutritionApi.foodPage).toHaveBeenLastCalledWith('rice', 0, 21, expect.anything());
  fireEvent.changeText(screen.getByLabelText('Recipe servings'), '2');
  fireEvent.changeText(screen.getByLabelText('Search ingredient'), 'rice');
  fireEvent.press(await screen.findByLabelText('Add Rice as an ingredient'));
  fireEvent.changeText(screen.getAllByLabelText('Rice quantity')[0], '150');
  fireEvent.press(screen.getAllByLabelText('Remove Rice')[1]);
  expect(screen.getByText('150 kcal', { exact: true })).toBeVisible();
  expect(screen.getByText('Per serving')).toBeVisible();
  expect(screen.getByText('75 kcal', { exact: true })).toBeVisible();
  expect(screen.getByText('2.25 g')).toBeVisible();
  expect(screen.getByText('15 g')).toBeVisible();
  expect(screen.getByText('0.75 g')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Increase servings' }));
  expect(screen.getByLabelText('Recipe servings')).toHaveDisplayValue('3');
  expect(screen.getByText('50 kcal', { exact: true })).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Decrease servings' }));
  fireEvent.press(screen.getByRole('button', { name: 'Create recipe' }));
  await waitFor(() => expect(nutritionApi.createRecipe).toHaveBeenCalled(), { timeout: 5000 });
  await waitFor(() => expect(screen.queryByLabelText('Recipe name')).toBeNull(), { timeout: 5000 });
  expect(nutritionApi.createRecipe).toHaveBeenCalledWith({
    name: 'Rice bowl',
    servings: 2,
    ingredients: [{ food_id: 1, quantity_grams: 150 }],
  });
}, 20000);

test('localizes food selection while preserving catalogue names', async () => {
  open('es');
  expect(screen.getByLabelText('Buscar alimento')).toBeTruthy();
  fireEvent.press(await screen.findByLabelText('Seleccionar Rice'));
  expect(screen.getByLabelText('Cantidad de alimento')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Añadir alimento' })).toBeTruthy();
});
