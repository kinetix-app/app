import { completeAccount, incompleteAccount } from '@/features/accounts/test/fixtures';
import { getAccount, getObjective, updateProfile, setObjective } from '@/features/accounts/api';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { HomeScreen } from '../components/HomeScreen';
import { nutritionApi } from '@/features/nutrition/api';
import { trainingApi } from '@/features/training/api';

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
jest.mock('@/features/accounts/api', () => ({
  getAccount: jest.fn(),
  getObjective: jest.fn(),
  updateProfile: jest.fn(),
  setObjective: jest.fn(),
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
const goal = {
  objective: 'build_muscle' as const,
  id: 1,
  user_id: 1,
  calories: 2100,
  protein: 105,
  carbohydrates: 262.5,
  fats: 70,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getAccount).mockResolvedValue(completeAccount);
  jest.mocked(getObjective).mockResolvedValue({ objective: 'build_muscle' });
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

test('home shows profile and an optional nutrition entry while keeping one bottom bar', async () => {
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  await screen.findByText('Alice');
  expect(screen.getByRole('tab', { name: 'Home' }).props.accessibilityState.selected).toBe(true);
  expect(trainingApi.routines).not.toHaveBeenCalled();
  expect(screen.getByText('Edit profile')).toBeTruthy();
  expect(screen.getByText('Change objective')).toBeTruthy();
  expect(screen.getByText('Edit nutrition goal')).toBeTruthy();
  expect(screen.getAllByLabelText('Main navigation')).toHaveLength(1);
  fireEvent.press(screen.getByRole('tab', { name: 'Nutrition' }));
  await screen.findByLabelText('Add food to Breakfast');
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

test('returning incomplete users must save their profile and explicitly select an objective, without a nutrition target', async () => {
  jest.mocked(getAccount).mockResolvedValue(incompleteAccount);
  jest.mocked(getObjective).mockResolvedValue({ objective: null });
  const profileSaved = {
    ...completeAccount,
    onboarding: { profile_complete: true, objective_selected: false, required: true },
  };
  jest.mocked(updateProfile).mockResolvedValue(profileSaved);
  jest.mocked(setObjective).mockResolvedValue({ objective: 'maintain_weight' });
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  await screen.findByText('Your profile');
  expect(screen.queryByLabelText('Main navigation')).toBeNull();
  for (const [label, value] of [
    ['Name', 'Alice'],
    ['Age (years)', '25'],
    ['Height (cm)', '170'],
    ['Weight', '70'],
  ])
    fireEvent.changeText(screen.getByLabelText(label), value);
  fireEvent.press(screen.getByText('Save profile'));
  await screen.findByText('Choose kg or lb.');
  expect(updateProfile).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('radio', { name: 'kg' }));
  fireEvent.press(screen.getByText('Save profile'));
  await screen.findByText("What's your goal?");
  expect(screen.getAllByRole('radio')).toHaveLength(4);
  expect(
    screen.getByRole('button', { name: 'Save objective' }).props.accessibilityState.disabled,
  ).toBe(true);
  fireEvent.press(screen.getByRole('radio', { name: 'Maintain weight' }));
  jest.mocked(getAccount).mockResolvedValue(completeAccount);
  fireEvent.press(screen.getByText('Save objective'));
  await screen.findByLabelText('Main navigation');
  expect(setObjective).toHaveBeenCalledWith('maintain_weight');
  expect(nutritionApi.goal).not.toHaveBeenCalled();
});

test('account switches reset navigation/forms and cancel all private feature queries', async () => {
  jest.mocked(trainingApi.routines).mockImplementationOnce(() => new Promise(() => {}));
  const view = render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  await screen.findByText('Alice');
  fireEvent.press(screen.getByRole('tab', { name: 'Workout' }));
  await waitFor(() => expect(trainingApi.routines).toHaveBeenCalledTimes(1));
  const signal = jest.mocked(trainingApi.routines).mock.calls[0][1];
  jest.mocked(getAccount).mockResolvedValue({ ...completeAccount, id: 2 });
  await act(async () => view.rerender(<HomeScreen accountId={2} onSignOut={jest.fn()} />));
  await screen.findByText('Alice');
  expect(signal?.aborted).toBe(true);
  expect(screen.getByRole('tab', { name: 'Home' }).props.accessibilityState.selected).toBe(true);
  expect(screen.queryByText('Routines')).toBeNull();
});
