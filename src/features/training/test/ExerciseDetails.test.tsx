import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExerciseDetails } from '../components/ExerciseDetails';
import { rangeStart, duration } from '../components/ExerciseEvolution';
import { trainingApi } from '../api';
import { getAccount } from '@/features/accounts/api';
import { exampleExercise } from './fixtures';

jest.mock('@expo/vector-icons', () => ({ Feather: 'Icon' }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('../components/ExerciseMedia', () => ({ ExerciseMedia: () => null }));
jest.mock('../api', () => ({
  trainingApi: { exercise: jest.fn(), exerciseHistory: jest.fn(), exerciseEvolution: jest.fn() },
}));
jest.mock('@/features/accounts/api', () => ({ getAccount: jest.fn() }));

function open() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}
    >
      <ExerciseDetails accountId={7} exerciseId={1} onClose={jest.fn()} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() } as unknown as ReturnType<
      typeof AccessibilityInfo.addEventListener
    >);
  jest.mocked(trainingApi.exercise).mockResolvedValue(exampleExercise);
  jest
    .mocked(getAccount)
    .mockResolvedValue({ profile: { measurement_system: 'metric' } } as Awaited<
      ReturnType<typeof getAccount>
    >);
  jest.mocked(trainingApi.exerciseEvolution).mockResolvedValue({
    exercise_id: 1,
    activity_type: 'gym',
    weight_unit: 'kg',
    distance_unit: 'km',
    days: [],
  });
});

test('keeps instructions and provides accessible history and evolution tabs', async () => {
  jest.mocked(trainingApi.exerciseHistory).mockResolvedValue({ items: [], limit: 20, offset: 0 });
  open();
  expect(await screen.findByText('1. Lower, then press.')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'History' }));
  expect(await screen.findByText('No previous sessions for this exercise.')).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'History' }).props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByRole('tab', { name: 'Evolution' }));
  expect(
    await screen.findByText('No data in this period. No observations are available yet.'),
  ).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'Instructions' }));
  expect(screen.getByText('1. Lower, then press.')).toBeTruthy();
});

test('retries history and loads the next page with explicit set units', async () => {
  const set = {
    set_number: 1,
    reps: 12,
    weight_kg: '40',
    weight: { value: '40', unit: 'kg' as const },
    duration_seconds: null,
    distance_km: null,
  };
  const item = {
    session_id: 1,
    started_at: '2026-10-24T16:00:00Z',
    ended_at: '2026-10-24T16:45:00Z',
    name: 'Workout',
    activity_type: 'gym',
    sets: [
      set,
      { ...set },
      {
        ...set,
        reps: null,
        weight: null,
        weight_kg: null,
        distance_km: '1.25',
        duration_seconds: 750,
      },
    ],
  };
  jest
    .mocked(trainingApi.exerciseHistory)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ items: [item], limit: 1, offset: 0 })
    .mockResolvedValueOnce({ items: [], limit: 1, offset: 1 });
  open();
  fireEvent.press(await screen.findByRole('tab', { name: 'History' }));
  fireEvent.press(await screen.findByText('Retry'));
  expect(await screen.findByText('1 · 12 reps · 40 kg')).toBeTruthy();
  expect(screen.getByText('2 · 12 reps · 40 kg')).toBeTruthy();
  expect(screen.getByText('3 · 1.25 km · 00:12:30')).toBeTruthy();
  fireEvent.press(screen.getByText('Load more history'));
  await waitFor(() => expect(screen.queryByText('Load more history')).toBeNull());
  expect(screen.getByText('Workout')).toBeTruthy();
  expect(trainingApi.exerciseHistory).toHaveBeenLastCalledWith(1, 1, expect.anything());
});

test('selects observations, resets on metric change and explains estimates', async () => {
  const date = new Date().toISOString().slice(0, 10);
  jest.mocked(trainingApi.exerciseEvolution).mockResolvedValue({
    exercise_id: 1,
    activity_type: 'gym',
    weight_unit: 'kg',
    distance_unit: 'km',
    days: [
      {
        date,
        estimated_1rm: '70.0',
        weight: '60.0',
        volume: '300.0',
        reps: 5,
        distance: null,
        duration_seconds: null,
        volume_partial: false,
      },
    ],
  });
  open();
  fireEvent.press(await screen.findByRole('tab', { name: 'Evolution' }));
  fireEvent.press(await screen.findByRole('button', { name: `${date}, 70.0 kg` }));
  expect(
    screen.getByRole('button', { name: `${date}, 70.0 kg` }).props.accessibilityState.selected,
  ).toBe(true);
  fireEvent.press(screen.getByRole('button', { name: 'About Estimated strength (1RM)' }));
  expect(screen.getByText(/we do not know how close/)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Close explanation' }));
  fireEvent.press(screen.getByRole('tab', { name: 'Weight' }));
  expect(
    screen.getByRole('button', { name: `${date}, 60.0 kg` }).props.accessibilityState.selected,
  ).toBe(false);
});

test('clamps UTC month boundaries and formats durations', () => {
  expect(rangeStart(new Date('2024-03-31T23:59:00Z'), 1)).toBe('2024-02-29');
  expect(rangeStart(new Date('2025-03-31T00:00:00Z'), 1)).toBe('2025-02-28');
  expect(duration(0)).toBe('0s');
  expect(duration(3720)).toBe('1h 2m');
});

test('retries evolution using imperial profile units', async () => {
  jest
    .mocked(getAccount)
    .mockResolvedValue({ profile: { measurement_system: 'imperial' } } as Awaited<
      ReturnType<typeof getAccount>
    >);
  jest
    .mocked(trainingApi.exerciseEvolution)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({
      exercise_id: 1,
      activity_type: 'gym',
      weight_unit: 'lb',
      distance_unit: 'mi',
      days: [],
    });
  open();
  fireEvent.press(await screen.findByRole('tab', { name: 'Evolution' }));
  fireEvent.press(await screen.findByText('Retry'));
  expect(
    await screen.findByText('No data in this period. No observations are available yet.'),
  ).toBeTruthy();
  expect(trainingApi.exerciseEvolution).toHaveBeenLastCalledWith(1, 'lb', 'mi', expect.anything());
});
