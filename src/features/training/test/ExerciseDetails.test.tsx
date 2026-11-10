import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExerciseDetails } from '../components/ExerciseDetails';
import { trainingApi } from '../api';
import { exampleExercise } from './fixtures';

jest.mock('@expo/vector-icons', () => ({ Feather: 'Icon' }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('../components/ExerciseMedia', () => ({ ExerciseMedia: () => null }));
jest.mock('../api', () => ({ trainingApi: { exercise: jest.fn(), exerciseHistory: jest.fn() } }));

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
  jest.mocked(trainingApi.exercise).mockResolvedValue(exampleExercise);
});

test('keeps instructions and provides accessible history and evolution tabs', async () => {
  jest.mocked(trainingApi.exerciseHistory).mockResolvedValue({ items: [], limit: 20, offset: 0 });
  open();
  expect(await screen.findByText('1. Lower, then press.')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'History' }));
  expect(await screen.findByText('No previous sessions for this exercise.')).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'History' }).props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByRole('tab', { name: 'Evolution' }));
  expect(screen.getByText('Graphs will be available here in a future update.')).toBeTruthy();
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
