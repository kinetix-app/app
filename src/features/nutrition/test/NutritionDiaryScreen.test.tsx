import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NutritionDiaryScreen } from '../components/NutritionDiaryScreen';
import { nutritionApi } from '../api';
import type { NutritionGoal } from '../schemas';

jest.mock('@expo/vector-icons', () => ({ Feather: 'Icon' }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('../components/AddFoodScreen', () => ({
  AddFoodScreen: ({
    meal,
    date,
    onClose,
    onSaved,
  }: {
    meal: string;
    date: string;
    onClose: () => void;
    onSaved: () => void;
  }) => {
    const { Text } = jest.requireActual('react-native');
    return (
      <>
        <Text>
          {meal} on {date}
        </Text>
        <Text onPress={onClose}>Close food</Text>
        <Text onPress={onSaved}>Save food</Text>
      </>
    );
  },
}));
jest.mock('../api', () => ({
  nutritionApi: { goal: jest.fn(), day: jest.fn(), deleteMealItem: jest.fn() },
}));
const goal: NutritionGoal = {
  id: 1,
  user_id: 7,
  objective: null,
  calories: 2000,
  protein: 100,
  carbohydrates: 0,
  fats: 50,
};
const day = {
  date: '2026-10-28',
  calories: 500,
  protein: 110,
  carbohydrates: 40,
  fats: 10,
  items: [
    {
      id: 1,
      meal_type: 'breakfast',
      food_id: 1,
      name: 'Rice',
      quantity_grams: 100,
      calories: 100,
      protein: 3,
      carbohydrates: 20,
      fats: 1,
    },
    {
      id: 2,
      meal_type: 'snack',
      recipe_id: 2,
      name: 'Bowl',
      servings: 1,
      calories: 200,
      protein: 6,
      carbohydrates: 40,
      fats: 2,
    },
    {
      id: 3,
      meal_type: 'dinner',
      recipe_id: 2,
      name: 'Two bowls',
      servings: 2,
      calories: 400,
      protein: 12,
      carbohydrates: 80,
      fats: 4,
    },
  ],
};
function open() {
  const onBack = jest.fn();
  const onEditGoal = jest.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } },
        })
      }
    >
      <NutritionDiaryScreen accountId={7} onBack={onBack} onEditGoal={onEditGoal} />
    </QueryClientProvider>,
  );
  return { onBack, onEditGoal };
}
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(nutritionApi.goal).mockResolvedValue(goal);
  jest.mocked(nutritionApi.day).mockResolvedValue(day);
});
test('displays meal quantities and caps progress at the goal; navigation callbacks work', async () => {
  const { onBack, onEditGoal } = open();
  expect(await screen.findByText('Rice')).toBeTruthy();
  expect(screen.getByText('100 g')).toBeTruthy();
  expect(screen.getByText('1 serving')).toBeTruthy();
  expect(screen.getByText('2 servings')).toBeTruthy();
  expect(screen.getByLabelText('Protein: 110 of 100 grams')).toHaveAccessibilityValue({
    min: 0,
    max: 100,
    now: 100,
  });
  expect(screen.getByLabelText('Carbs: 40 of 0 grams').props.accessibilityValue).toBeUndefined();
  fireEvent.press(screen.getByLabelText('Back to home'));
  fireEvent.press(screen.getByLabelText('Edit nutrition goal'));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(onEditGoal).toHaveBeenCalledTimes(1);
});
test('deletes only the chosen logged item and refreshes the day', async () => {
  open();
  await screen.findByText('Rice');
  expect(screen.queryByLabelText('Delete Rice')).toBeNull();
  fireEvent.press(screen.getByLabelText('Edit Breakfast'));
  jest.mocked(nutritionApi.day).mockResolvedValue({ ...day, items: day.items.slice(1) });
  fireEvent.press(screen.getByLabelText('Delete Rice'));
  await waitFor(() => expect(screen.queryByText('Rice')).toBeNull());
  expect(nutritionApi.deleteMealItem).toHaveBeenCalledWith(1);
  expect(screen.getByText('Bowl')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Finish editing Breakfast'));
  expect(screen.getByLabelText('Edit Breakfast')).toBeTruthy();
});
test('changes the queried day and refreshes after adding a meal', async () => {
  open();
  await screen.findByText('Rice');
  const tab = screen.getAllByRole('tab').find((item) => !item.props.accessibilityState.selected)!;
  fireEvent.press(tab);
  await waitFor(() => expect(nutritionApi.day).toHaveBeenCalledTimes(2));
  const selectedDate = jest.mocked(nutritionApi.day).mock.calls[1][0];
  fireEvent.press(screen.getByLabelText('Add food to Snacks'));
  expect(screen.getByText(`Snacks on ${selectedDate}`)).toBeTruthy();
  fireEvent.press(screen.getByText('Save food'));
  await waitFor(() => expect(nutritionApi.day).toHaveBeenCalledTimes(3));
  fireEvent.press(screen.getByText('Close food'));
  expect(screen.getByText('Nutrition')).toBeTruthy();
});
test('allows tracking without a target and retries a failed goal request', async () => {
  jest
    .mocked(nutritionApi.goal)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(null);
  open();
  fireEvent.press(await screen.findByLabelText('Retry loading nutrition goal'));
  expect(
    await screen.findByText(
      'No nutrition target yet. You can keep recording food and set one later.',
    ),
  ).toBeTruthy();
  expect(
    screen.getByLabelText('Protein: 110 of unknown grams').props.accessibilityValue,
  ).toBeUndefined();
});
