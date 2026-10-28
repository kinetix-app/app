import React from 'react';
import { FlatList } from 'react-native';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkoutHistory } from '../components/WorkoutHistory';
import { trainingApi } from '../api';
import type { CompletedSession } from '../schemas';
import { exampleExercise } from './fixtures';

jest.mock('@expo/vector-icons', () => ({ Feather: 'Icon' }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('../api', () => ({ trainingApi: { sessions: jest.fn(), session: jest.fn() } }));
const session: CompletedSession = {
  id: 1,
  client_session_id: null,
  routine_id: null,
  activity_type: 'gym',
  state: 'completed',
  started_at: '2026-10-28T10:00:00Z',
  ended_at: '2026-10-28T11:00:00Z',
  exercises: [
    {
      id: 1,
      exercise_order: 1,
      exercise: exampleExercise,
      sets: [
        {
          set_number: 1,
          reps: 8,
          weight_kg: '80',
          weight: { value: '80', unit: 'kg' },
          duration_seconds: null,
          distance_km: null,
        },
        {
          set_number: 2,
          reps: null,
          weight_kg: null,
          weight: null,
          duration_seconds: null,
          distance_km: null,
        },
      ],
    },
  ],
};
function open() {
  const onClose = jest.fn();
  const view = render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false, gcTime: 0 },
          },
        })
      }
    >
      <WorkoutHistory accountId={7} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { ...view, onClose };
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.resetAllMocks();
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});
test('shows the empty history and returns to routines', async () => {
  jest.mocked(trainingApi.sessions).mockResolvedValue({ items: [], limit: 20, offset: 0 });
  const { onClose } = open();
  expect(await screen.findByText('No completed workouts yet.')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Back to routines'));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(trainingApi.session).not.toHaveBeenCalled();
});
test('retries the list and detail independently and displays saved results including missing values', async () => {
  jest
    .mocked(trainingApi.sessions)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ items: [session], limit: 20, offset: 0 });
  jest
    .mocked(trainingApi.session)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(session);
  open();
  fireEvent.press(await screen.findByText('Retry'));
  fireEvent.press(await screen.findByLabelText('View workout 1'));
  fireEvent.press(await screen.findByText('Retry'));
  expect(await screen.findByText('1. Bench press')).toBeTruthy();
  expect(screen.getByText('Set 1: 80 kg · 8 reps')).toBeTruthy();
  expect(screen.getByText('Set 2: — kg · — reps')).toBeTruthy();
  expect(trainingApi.session).toHaveBeenLastCalledWith(1, 'kg', expect.anything());
  fireEvent.press(screen.getByLabelText('Back to history'));
  expect(await screen.findByLabelText('View workout 1')).toBeTruthy();
});
test('paginates, retries a failed next page and stops requesting after the last page', async () => {
  jest
    .mocked(trainingApi.sessions)
    .mockResolvedValueOnce({ items: [session], limit: 1, offset: 0 })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ items: [{ ...session, id: 2 }], limit: 2, offset: 1 });
  const view = open();
  await screen.findByLabelText('View workout 1');
  act(() => view.UNSAFE_getByType(FlatList).props.onEndReached());
  fireEvent.press((await screen.findAllByText('Retry')).at(-1)!);
  expect(await screen.findByLabelText('View workout 2')).toBeTruthy();
  expect(trainingApi.sessions).toHaveBeenNthCalledWith(2, 1, 'kg', expect.anything());
  expect(trainingApi.sessions).toHaveBeenNthCalledWith(3, 1, 'kg', expect.anything());
  act(() => view.UNSAFE_getByType(FlatList).props.onEndReached());
  await waitFor(() => expect(trainingApi.sessions).toHaveBeenCalledTimes(3));
});
