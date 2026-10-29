import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getObjective } from '@/features/accounts/api';
import { nutritionApi } from '../api';
import { NutritionGoalEditor } from '../components/NutritionGoalEditor';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('@react-native-community/slider', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View };
});
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
  expect(screen.getByLabelText('Protein percentage').props.value).toBe('');
  fireEvent.press(screen.getByText('Set up later'));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(nutritionApi.createGoal).not.toHaveBeenCalled();
});
test('percentage editing has no preset, rejects incomplete totals and creates rounded grams', async () => {
  jest.mocked(nutritionApi.goal).mockResolvedValue(null);
  jest.mocked(nutritionApi.createGoal).mockResolvedValue({
    ...existing,
    calories: 2000,
    protein: 150,
    carbohydrates: 200,
    fats: 66.67,
  });
  const onClose = editor();
  await screen.findByLabelText('Protein percentage');
  expect(screen.getByLabelText('Protein percentage').props.value).toBe('');
  expect(screen.getByRole('button', { name: 'Save goal' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Daily calorie goal'), '2000');
  fireEvent.changeText(screen.getByLabelText('Carbohydrate percentage'), '40');
  fireEvent.changeText(screen.getByLabelText('Protein percentage'), '30');
  fireEvent.changeText(screen.getByLabelText('Fat percentage'), '29.99');
  expect(screen.getByText('1999.80 kcal · 99.99%')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Save goal' }));
  expect(nutritionApi.createGoal).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Fat percentage'), '30');
  expect(screen.getByText('200.00 g')).toBeTruthy();
  expect(screen.getByText('66.67 g')).toBeTruthy();
  expect(screen.getByText('2000.00 kcal · 100.00%')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Save goal' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(nutritionApi.createGoal).toHaveBeenCalledWith({
    calories: 2000,
    carbohydrates: 200,
    protein: 150,
    fats: 66.67,
  });
});

test('legacy shares are not normalized and opening the editor never saves', async () => {
  jest.mocked(nutritionApi.goal).mockResolvedValue(existing);
  const onClose = editor();
  await waitFor(() => expect(screen.getByLabelText('Fat percentage').props.value).toBe('0.00'));
  expect(screen.getByText(/Percentages must total 100% to save/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save goal' })).toBeDisabled();
  expect(screen.queryByLabelText('Daily protein goal')).toBeNull();
  expect(screen.getByRole('radio', { name: 'Grams' })).toBeTruthy();
  fireEvent.press(screen.getByText('Back'));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(nutritionApi.updateGoal).not.toHaveBeenCalled();
});

test('failed percentage save retains the split, permits retry and prevents duplicate requests', async () => {
  jest.mocked(nutritionApi.goal).mockResolvedValue({
    ...existing,
    calories: 2000,
    carbohydrates: 200,
    protein: 150,
    fats: 66.67,
  });
  let reject: (reason: Error) => void = () => undefined;
  jest
    .mocked(nutritionApi.updateGoal)
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    )
    .mockResolvedValueOnce(existing);
  const onClose = editor();
  await waitFor(() => expect(screen.getByLabelText('Daily calorie goal').props.value).toBe('2000'));
  fireEvent.press(screen.getByRole('button', { name: 'Save goal' }));
  fireEvent.press(screen.getByRole('button', { name: 'Save goal' }));
  await waitFor(() => expect(nutritionApi.updateGoal).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.getByLabelText('Protein percentage').props.editable).toBe(false),
  );
  reject(new Error('offline'));
  await screen.findByText('Could not save your goal. Try again.');
  expect(screen.getByLabelText('Protein percentage').props.value).toBe('30.00');
  fireEvent.press(screen.getByRole('button', { name: 'Save goal' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
});

test('switching accounts resets private form drafts and editing mode', async () => {
  jest.mocked(nutritionApi.goal).mockResolvedValueOnce(existing).mockResolvedValueOnce(null);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = (accountId: number) => (
    <QueryClientProvider client={client}>
      <NutritionGoalEditor accountId={accountId} onClose={jest.fn()} />
    </QueryClientProvider>
  );
  const { rerender } = render(view(1));
  await waitFor(() => expect(screen.getByLabelText('Protein percentage').props.value).not.toBe(''));
  fireEvent.changeText(screen.getByLabelText('Protein percentage'), '90');
  rerender(view(2));
  await screen.findByLabelText('Protein percentage');
  expect(screen.getByLabelText('Protein percentage').props.value).toBe('');
  expect(screen.getByLabelText('Daily calorie goal').props.value).toBe('');
  expect(nutritionApi.updateGoal).not.toHaveBeenCalled();
});

test('invalid calories stay unsavable and valid percentages preview grams', async () => {
  jest.mocked(nutritionApi.goal).mockResolvedValue(null);
  editor();
  await screen.findByLabelText('Protein percentage');
  fireEvent.changeText(screen.getByLabelText('Daily calorie goal'), '0');
  for (const [label, value] of [
    ['Carbohydrate percentage', '40'],
    ['Protein percentage', '30'],
    ['Fat percentage', '30'],
  ]) {
    fireEvent.changeText(screen.getByLabelText(label), value);
  }
  expect(screen.getByRole('button', { name: 'Save goal' })).toBeDisabled();
  expect(screen.getByText(/Enter daily calories from/)).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Daily calorie goal'), '2000');
  expect(screen.getByRole('button', { name: 'Save goal' })).toBeEnabled();
  expect(screen.getByText('150.00 g')).toBeTruthy();
  expect(screen.getByText('66.67 g')).toBeTruthy();
  expect(nutritionApi.createGoal).not.toHaveBeenCalled();
});

test('range changes and manual input stay synchronized without redistributing other macros', async () => {
  jest.mocked(nutritionApi.goal).mockResolvedValue(null);
  editor();
  await screen.findByLabelText('Protein percentage');
  fireEvent(screen.getByLabelText('Protein range'), 'valueChange', 28.5);
  expect(screen.getByLabelText('Protein percentage').props.value).toBe('28.50');
  expect(screen.getByLabelText('Fat percentage').props.value).toBe('');
  fireEvent.changeText(screen.getByLabelText('Protein percentage'), '31.25');
  expect(screen.getByLabelText('Protein range').props.value).toBe(31.25);
  fireEvent.changeText(screen.getByLabelText('Protein percentage'), '-1');
  expect(screen.getByLabelText('Protein range').props.value).toBe(0);
  expect(screen.getByRole('button', { name: 'Save goal' })).toBeDisabled();
  expect(nutritionApi.createGoal).not.toHaveBeenCalled();
});

test('switches between percentage and gram drafts with live equivalents and no saved-data drift', async () => {
  jest.mocked(nutritionApi.goal).mockResolvedValue(existing);
  editor();
  await waitFor(() => expect(screen.getByLabelText('Fat percentage').props.value).toBe('0.00'));
  fireEvent.press(screen.getByRole('radio', { name: 'Grams' }));
  expect(screen.getByLabelText('Protein grams').props.value).toBe('150.12');
  fireEvent.press(screen.getByRole('radio', { name: 'Percentages' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Grams' }));
  expect(screen.getByLabelText('Protein grams').props.value).toBe('150.12');
  fireEvent.changeText(screen.getByLabelText('Daily calorie goal'), '2000');
  fireEvent.changeText(screen.getByLabelText('Protein grams'), '150');
  fireEvent.changeText(screen.getByLabelText('Carbohydrate grams'), '200');
  fireEvent.changeText(screen.getByLabelText('Fat grams'), '66.67');
  fireEvent.press(screen.getByRole('radio', { name: 'Percentages' }));
  expect(screen.getByLabelText('Protein percentage').props.value).toBe('30.00');
  expect(screen.getByText('66.67 g')).toBeTruthy();
  fireEvent.press(screen.getByRole('radio', { name: 'Grams' }));
  expect(screen.getByLabelText('Fat grams').props.value).toBe('66.67');
  expect(screen.getAllByText('30.00%').length).toBeGreaterThan(0);
  expect(nutritionApi.updateGoal).not.toHaveBeenCalled();
});

test('shows required calories and blocks saving over-budget percentages and grams', async () => {
  jest.mocked(nutritionApi.goal).mockResolvedValue(null);
  editor();
  await screen.findByLabelText('Daily calorie goal');
  fireEvent.changeText(screen.getByLabelText('Daily calorie goal'), '2000');
  for (const [label, value] of [
    ['Carbohydrate percentage', '60'],
    ['Protein percentage', '30'],
    ['Fat percentage', '30'],
  ])
    fireEvent.changeText(screen.getByLabelText(label), value);
  expect(screen.getByText('2400.00 kcal · 120.00%')).toBeTruthy();
  expect(screen.getByText('Out of budget · 400.00 kcal over 2000.00 kcal')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save goal' })).toBeDisabled();
  fireEvent.press(screen.getByRole('radio', { name: 'Grams' }));
  expect(screen.getByLabelText('Carbohydrate grams').props.value).toBe('300.00');
  expect(screen.getByRole('button', { name: 'Save goal' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Carbohydrate grams'), '200');
  expect(screen.queryByText(/Out of budget/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Save goal' })).toBeEnabled();
  expect(nutritionApi.createGoal).not.toHaveBeenCalled();
});
