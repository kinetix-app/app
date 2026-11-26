import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/i18n/Language';
import { nutritionApi } from '../api';
import { NutritionGoalRecommendation } from '../components/NutritionGoalRecommendation';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('../components/NutritionGoalEditor', () => ({
  NutritionGoalEditor: () => <></>,
}));
jest.mock('../api', () => ({
  nutritionApi: {
    recommendation: jest.fn(),
    goal: jest.fn(),
    createGoal: jest.fn(),
    updateGoal: jest.fn(),
  },
}));
const goal = { calories: 2400, protein: 128, carbohydrates: 292, fats: 80 };
const suggestion = {
  version: 'mifflin_v1',
  available: true,
  reason: null,
  missing_fields: [],
  objective: 'build_muscle' as const,
  bmr: 1780,
  maintenance_calories: 2182,
  activity_factor: 1.2,
  adjustment_percent: 10,
  protein_per_kg: 1.6,
  goal,
};
function open(language: 'en' | 'es' = 'en') {
  const onClose = jest.fn();
  render(
    <LanguageProvider language={language}>
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false, gcTime: 0 },
              mutations: { retry: false, gcTime: 0 },
            },
          })
        }
      >
        <NutritionGoalRecommendation accountId={1} onClose={onClose} />
      </QueryClientProvider>
    </LanguageProvider>,
  );
  return onClose;
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(nutritionApi.recommendation).mockResolvedValue(suggestion);
  jest.mocked(nutritionApi.goal).mockResolvedValue(null);
});
test.each([
  [2200, 'Suggestion: 200 kcal/day above your saved target.'],
  [2600, 'Suggestion: 200 kcal/day below your saved target.'],
  [2400, 'Matches your saved target.'],
])('compares the suggestion with a saved %s kcal target', async (calories, message) => {
  jest.mocked(nutritionApi.goal).mockResolvedValue({
    ...goal,
    calories,
    id: 1,
    user_id: 1,
    objective: 'build_muscle',
  });
  open();
  await screen.findByText(message);
  expect(screen.getByText(`Your saved target: ${calories} kcal/day`)).toBeTruthy();
  expect(nutritionApi.updateGoal).not.toHaveBeenCalled();
});
test('existing targets are updated only on acceptance and failed saves keep the preview', async () => {
  jest
    .mocked(nutritionApi.goal)
    .mockResolvedValue({ ...goal, id: 1, user_id: 1, objective: 'lose_fat' });
  jest.mocked(nutritionApi.updateGoal).mockRejectedValue(new Error('Offline'));
  const close = open();
  await screen.findByText('2400 kcal/day');
  expect(nutritionApi.updateGoal).not.toHaveBeenCalled();
  fireEvent(
    screen.getByLabelText('This adult estimate is appropriate for me'),
    'valueChange',
    true,
  );
  fireEvent.press(screen.getByText('Accept suggestion'));
  await screen.findByText('Could not save your goal. Try again.');
  expect(close).not.toHaveBeenCalled();
  expect(nutritionApi.updateGoal).toHaveBeenCalledWith(goal);
});
test('preview is read-only until explicit acceptance and saves the suggested values', async () => {
  jest
    .mocked(nutritionApi.createGoal)
    .mockResolvedValue({ ...goal, id: 1, user_id: 1, objective: 'build_muscle' });
  const close = open();
  await screen.findByText('2400 kcal/day');
  expect(nutritionApi.createGoal).not.toHaveBeenCalled();
  fireEvent(
    screen.getByLabelText('This adult estimate is appropriate for me'),
    'valueChange',
    true,
  );
  fireEvent.press(screen.getByText('Accept suggestion'));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(nutritionApi.createGoal).toHaveBeenCalledWith(goal);
});
test('unavailable estimates explain missing inputs and allow manual entry', async () => {
  jest.mocked(nutritionApi.recommendation).mockResolvedValue({
    ...suggestion,
    available: false,
    goal: null,
    reason: 'Complete your profile.',
    missing_fields: ['activity_level'],
  });
  open();
  await screen.findByText('Complete your profile.');
  expect(screen.queryByText('Accept suggestion')).toBeNull();
  fireEvent.press(screen.getByText('Enter manually'));
  expect(nutritionApi.createGoal).not.toHaveBeenCalled();
});

test('uses stable reason codes for Spanish unavailable recommendations', async () => {
  jest.mocked(nutritionApi.recommendation).mockResolvedValue({
    ...suggestion,
    available: false,
    goal: null,
    reason: 'Changed server wording',
    reason_code: 'underage',
  });
  open('es');
  expect(
    await screen.findByText(
      'Las sugerencias automáticas están disponibles para mayores de 18 años.',
    ),
  ).toBeTruthy();
});

test('shows a Spanish load failure and recovers through retry', async () => {
  jest
    .mocked(nutritionApi.recommendation)
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(suggestion);

  open('es');
  expect(await screen.findByText('No se pudo cargar tu sugerencia.')).toBeTruthy();

  fireEvent.press(screen.getByText('Reintentar'));

  expect(await screen.findByText('2400 kcal/día')).toBeTruthy();
  expect(screen.getByText('Aceptar sugerencia')).toBeTruthy();
  expect(nutritionApi.recommendation).toHaveBeenCalledTimes(2);
});
