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
function open(onShare?: (sessionId: number) => void) {
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
      <WorkoutHistory accountId={7} onClose={onClose} onShare={onShare} />
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
  expect(screen.getByText('Set 1')).toBeTruthy();
  expect(screen.getByText('80 kg · 8 reps')).toBeTruthy();
  expect(screen.getByText('— kg · — reps')).toBeTruthy();
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

test('preserves zero and missing cardio measurements with explicit distance and clock units', async () => {
  const cardioSet = {
    set_number: 1,
    reps: null,
    weight_kg: null,
    weight: null,
    duration_seconds: 750,
    distance_km: '1.25',
  };
  const cardioSession: CompletedSession = {
    ...session,
    exercises: [
      {
        ...session.exercises[0],
        exercise: { ...exampleExercise, activity_type: 'cardio' },
        sets: [
          cardioSet,
          { ...cardioSet, set_number: 2, distance_km: null, duration_seconds: 0 },
          { ...cardioSet, set_number: 3, duration_seconds: null },
        ],
      },
    ],
  };
  jest
    .mocked(trainingApi.sessions)
    .mockResolvedValue({ items: [cardioSession], limit: 20, offset: 0 });
  jest.mocked(trainingApi.session).mockResolvedValue(cardioSession);
  open();
  fireEvent.press(await screen.findByLabelText('View workout 1'));
  expect(await screen.findByText('1.25 km · 00:12:30')).toBeTruthy();
  expect(screen.getByText('— km · 00:00:00')).toBeTruthy();
  expect(screen.getByText('1.25 km · —')).toBeTruthy();
});

test('completed workouts can be shared to the feed from the list and the details', async () => {
  jest.mocked(trainingApi.sessions).mockResolvedValue({ items: [session], limit: 50, offset: 0 });
  jest.mocked(trainingApi.session).mockResolvedValue(session);
  const onShare = jest.fn();
  open(onShare);
  fireEvent.press(await screen.findByRole('button', { name: 'Share workout 1 to feed' }));
  expect(onShare).toHaveBeenLastCalledWith(1);
  expect(trainingApi.session).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'View workout 1' }));
  expect(await screen.findByRole('header', { name: 'Workout preview' })).toBeTruthy();
  expect(await screen.findByText('1 h')).toBeTruthy();
  fireEvent.press(await screen.findByRole('button', { name: 'Share to feed' }));
  expect(onShare).toHaveBeenCalledTimes(2);
  expect(onShare).toHaveBeenLastCalledWith(1);
  expect(await screen.findByRole('header', { name: 'Workout history' })).toBeTruthy();
});

test('without a share handler the history offers no share buttons', async () => {
  jest.mocked(trainingApi.sessions).mockResolvedValue({ items: [session], limit: 50, offset: 0 });
  jest.mocked(trainingApi.session).mockResolvedValue(session);
  open();
  const entry = await screen.findByRole('button', { name: 'View workout 1' });
  expect(screen.queryByRole('button', { name: 'Share workout 1 to feed' })).toBeNull();
  fireEvent.press(entry);
  expect(await screen.findByText('1. Bench press')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Share to feed' })).toBeNull();
});
