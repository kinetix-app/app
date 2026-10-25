import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getObjective } from '@/features/accounts/api';
import { nutritionApi } from '../api';
import { NutritionGoalEditor } from '../components/NutritionGoalEditor';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('@/features/accounts/api', () => ({ getObjective: jest.fn() }));
jest.mock('../api', () => ({
  nutritionApi: { goal: jest.fn(), createGoal: jest.fn(), updateGoal: jest.fn() },
}));
const existing = {
  id: 1,
  user_id: 1,
  objective: 'gain_weight' as const,
  calories: 2400.15,
  protein: 150.12,
  carbohydrates: 250.25,
  fats: 0,
};
function editor() {
  const onClose = jest.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } },
        })
      }
    >
      <NutritionGoalEditor accountId={1} onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getObjective).mockResolvedValue({ objective: 'build_muscle' });
});
test('absent target starts blank, can be skipped, and never invents suggested amounts', async () => {
  jest.mocked(nutritionApi.goal).mockResolvedValue(null);
  const onClose = editor();
  await screen.findByLabelText('Daily calorie goal');
  expect(screen.getByLabelText('Daily calorie goal').props.value).toBe('');
  expect(screen.getByLabelText('Daily protein goal').props.value).toBe('');
  fireEvent.press(screen.getByText('Set up later'));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(nutritionApi.createGoal).not.toHaveBeenCalled();
});
test('reopens exact grams including zero; failed save retains values and permits explicit reassociation', async () => {
  jest.mocked(nutritionApi.goal).mockResolvedValue(existing);
  jest
    .mocked(nutritionApi.updateGoal)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ ...existing, objective: 'build_muscle' });
  const onClose = editor();
  await waitFor(() =>
    expect(screen.getByLabelText('Daily protein goal').props.value).toBe('150.12'),
  );
  expect(screen.getByLabelText('Daily fat goal').props.value).toBe('0');
  expect(screen.getByText(/These saved amounts belong to Gain weight/)).toBeTruthy();
  fireEvent.press(screen.getByText('Save goal'));
  await screen.findByText('Could not save your goal. Try again.');
  expect(screen.getByLabelText('Daily protein goal').props.value).toBe('150.12');
  fireEvent.press(screen.getByText('Save goal'));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(nutritionApi.updateGoal).toHaveBeenLastCalledWith({
    calories: 2400.15,
    protein: 150.12,
    carbohydrates: 250.25,
    fats: 0,
  });
});
