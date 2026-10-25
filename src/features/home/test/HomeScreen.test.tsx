import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { HomeScreen } from '../components/HomeScreen';
import { nutritionApi } from '@/features/nutrition/api';
import { trainingApi } from '@/features/training/api';
import { ApiError } from '@/services/apiClient';

jest.mock(
  '@react-native-async-storage/async-storage',
  () => ({
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  }),
  { virtual: true },
);
jest.mock('expo-crypto', () => ({ randomUUID: () => '3e17c183-38a9-4b5c-b953-000000000001' }));
jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn(),
  VideoView: jest.requireActual('react-native').View,
}));
jest.mock('react-native-draggable-flatlist', () => ({
  __esModule: true,
  default: jest.requireActual('react-native').FlatList,
}));
jest.mock('expo-network', () => ({
  useNetworkState: () => ({ isConnected: true, isInternetReachable: true }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('@/features/nutrition/api', () => ({
  nutritionApi: {
    goal: jest.fn(),
    createGoal: jest.fn(),
    updateGoal: jest.fn(),
    day: jest.fn(),
    foods: jest.fn(),
  },
}));
jest.mock('@/features/training/api', () => ({
  trainingApi: { draft: jest.fn(), routines: jest.fn(), saveDraft: jest.fn() },
}));
const goal = { id: 1, user_id: 1, calories: 2100, protein: 105, carbohydrates: 262.5, fats: 70 };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(nutritionApi.goal).mockResolvedValue(goal);
  jest.mocked(nutritionApi.updateGoal).mockImplementation(async (input) => ({ ...goal, ...input }));
  jest.mocked(nutritionApi.createGoal).mockImplementation(async (input) => ({ ...goal, ...input }));
  jest.mocked(nutritionApi.day).mockResolvedValue({
    date: '2026-10-25',
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fats: 0,
    items: [],
  });
  jest.mocked(nutritionApi.foods).mockResolvedValue([]);
  jest.mocked(trainingApi.draft).mockResolvedValue(null);
  jest.mocked(trainingApi.saveDraft).mockImplementation(async (id, snapshot) => ({
    ...snapshot,
    client_session_id: id,
    state: 'draft',
  }));
  jest.mocked(trainingApi.routines).mockResolvedValue({ items: [], limit: 20, offset: 0 });
});

test('home defaults to goal setup, saves into the shared diary cache and keeps one bottom bar', async () => {
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  await screen.findByLabelText('Daily calorie goal');
  expect(screen.getByRole('tab', { name: 'Home' }).props.accessibilityState.selected).toBe(true);
  expect(trainingApi.routines).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Daily calorie goal'), '2400');
  fireEvent.press(screen.getByText('Save goal'));
  await screen.findByText('Nutrition', { exact: true });
  await waitFor(() =>
    expect(nutritionApi.updateGoal).toHaveBeenCalledWith({
      calories: 2400,
      carbohydrates: 300,
      protein: 120,
      fats: 80,
    }),
  );
  expect(screen.getAllByLabelText('Main navigation')).toHaveLength(1);
  expect(screen.getByRole('tab', { name: 'Nutrition' }).props.accessibilityState.selected).toBe(
    true,
  );
  expect(screen.getByLabelText('Add food to Breakfast')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'Home' }));
  expect(screen.getByLabelText('Daily calorie goal').props.value).toBe('2400');
});

test('plus starts the existing workout editor and a minimized draft survives navigation without duplicate starts', async () => {
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  await waitFor(() =>
    expect(screen.getByLabelText('Start workout').props.accessibilityState.disabled).toBe(false),
  );
  fireEvent.press(screen.getByLabelText('Start workout'));
  await screen.findByLabelText('Minimize workout');
  fireEvent.press(screen.getByLabelText('Minimize workout'));
  expect(screen.getByLabelText('Start workout').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByRole('tab', { name: 'Nutrition' }));
  await screen.findByLabelText('Add food to Breakfast');
  expect(screen.getByLabelText('Resume workout')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'Workout' }));
  await screen.findByText('Routines');
  expect(
    screen.getByRole('button', { name: 'Start workout' }).props.accessibilityState.disabled,
  ).toBe(true);
  fireEvent.press(screen.getByLabelText('Resume workout'));
  expect(screen.getByLabelText('Minimize workout')).toBeTruthy();
  expect(trainingApi.draft).toHaveBeenCalledTimes(1);
});

test('a missing goal can be created, and a failed save retains input for retry', async () => {
  jest.mocked(nutritionApi.goal).mockRejectedValue(new ApiError(404));
  jest
    .mocked(nutritionApi.createGoal)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(goal);
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  await screen.findByLabelText('Daily calorie goal');
  fireEvent.changeText(screen.getByLabelText('Daily calorie goal'), '2300');
  fireEvent.press(screen.getByText('Save goal'));
  await screen.findByText('Could not save your goal. Try again.');
  expect(screen.getByLabelText('Daily calorie goal').props.value).toBe('2300');
  fireEvent.press(screen.getByText('Save goal'));
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: 'Nutrition' }).props.accessibilityState.selected).toBe(
      true,
    ),
  );
  expect(nutritionApi.createGoal).toHaveBeenCalledTimes(2);
});

test('account switches reset navigation/forms and cancel all private feature queries', async () => {
  jest.mocked(trainingApi.routines).mockImplementationOnce(() => new Promise(() => {}));
  const view = render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  await screen.findByLabelText('Daily calorie goal');
  fireEvent.changeText(screen.getByLabelText('Daily calorie goal'), '9999');
  fireEvent.press(screen.getByRole('tab', { name: 'Workout' }));
  await waitFor(() => expect(trainingApi.routines).toHaveBeenCalledTimes(1));
  const signal = jest.mocked(trainingApi.routines).mock.calls[0][1];
  await act(async () => view.rerender(<HomeScreen accountId={2} onSignOut={jest.fn()} />));
  await waitFor(() => expect(screen.getByLabelText('Daily calorie goal').props.value).toBe('2100'));
  expect(signal?.aborted).toBe(true);
  expect(screen.getByRole('tab', { name: 'Home' }).props.accessibilityState.selected).toBe(true);
  expect(screen.queryByText('Routines')).toBeNull();
});
