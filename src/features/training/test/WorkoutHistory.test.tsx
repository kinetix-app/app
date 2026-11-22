import React from 'react';
import { FlatList } from 'react-native';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
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
  routine_id: 4,
  title: 'Strength A',
  activity_type: 'gym',
  state: 'completed',
  started_at: '2026-10-28T10:00:00Z',
  ended_at: '2026-10-28T11:00:00Z',
  total_reps: 8,
  total_volume_kg: '640.00',
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
  fireEvent.press(await screen.findByTestId('history-workout-1'));
  fireEvent.press(await screen.findByText('Retry'));
  expect(await screen.findByText('1. Bench press')).toBeTruthy();
  expect(screen.getByLabelText('Image of Bench press').props.source).toEqual({
    uri: exampleExercise.image_url,
  });
  expect(screen.getByRole('header', { name: session.title })).toBeTruthy();
  const results = within(screen.getByTestId('workout-exercise-0'));
  expect(results.getByRole('columnheader', { name: 'Weight (kg)' })).toBeTruthy();
  expect(results.getAllByRole('cell').map((cell) => cell.props.children)).toEqual([
    1,
    '80',
    8,
    2,
    '—',
    '—',
  ]);
  expect(trainingApi.session).toHaveBeenLastCalledWith(1, 'kg', expect.anything());
  fireEvent.press(screen.getByLabelText('Back to history'));
  expect(await screen.findByTestId('history-workout-1')).toBeTruthy();
});
test('groups paginated results by completion month and retries a failed next page', async () => {
  const older = {
    ...session,
    id: 3,
    routine_id: null,
    title: 'Training session',
    started_at: '2026-09-28T10:00:00Z',
    ended_at: '2026-09-28T11:00:00Z',
  };
  jest
    .mocked(trainingApi.sessions)
    .mockResolvedValueOnce({ items: [session], limit: 1, offset: 0 })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ items: [{ ...session, id: 2 }, older], limit: 3, offset: 1 });
  const view = open();
  const summary = within(await screen.findByTestId('history-workout-1'));
  expect(summary.getByText('1 h')).toBeTruthy();
  expect(summary.getByText(session.title)).toBeTruthy();
  expect(summary.getByText('640 kg')).toBeTruthy();
  expect(summary.getByText('Exercises')).toBeTruthy();
  expect(summary.queryByText('Bench press')).toBeNull();
  expect(trainingApi.session).not.toHaveBeenCalled();
  act(() => view.UNSAFE_getByType(FlatList).props.onEndReached());
  fireEvent.press(await screen.findByText('Retry'));
  expect(await screen.findByTestId('history-workout-2')).toBeTruthy();
  expect(screen.getAllByRole('header', { name: 'October 2026' })).toHaveLength(1);
  expect(screen.getByRole('header', { name: 'September 2026' })).toBeTruthy();
  expect(
    within(screen.getByTestId('history-workout-3')).getByText('Training session'),
  ).toBeTruthy();
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
          { ...cardioSet, set_number: 4, reps: 5, weight_kg: '25.00' },
        ],
      },
    ],
  };
  jest
    .mocked(trainingApi.sessions)
    .mockResolvedValue({ items: [cardioSession], limit: 20, offset: 0 });
  jest.mocked(trainingApi.session).mockResolvedValue(cardioSession);
  open();
  fireEvent.press(await screen.findByTestId('history-workout-1'));
  const cardio = within(await screen.findByLabelText('Cardio sets'));
  expect(cardio.getByRole('columnheader', { name: 'Distance (km)' })).toBeTruthy();
  expect(cardio.getAllByRole('cell').map((cell) => cell.props.children)).toEqual([
    1,
    '1.25',
    '00:12:30',
    2,
    '—',
    '00:00:00',
    3,
    '1.25',
    '—',
    4,
    '1.25',
    '00:12:30',
  ]);
  const legacy = within(screen.getByLabelText('Strength sets'));
  expect(legacy.getAllByRole('cell').map((cell) => cell.props.children)).toEqual([4, '25.00', 5]);
});

test('sharing a completed workout is available inside its detail', async () => {
  jest.mocked(trainingApi.sessions).mockResolvedValue({ items: [session], limit: 50, offset: 0 });
  jest.mocked(trainingApi.session).mockResolvedValue(session);
  const onShare = jest.fn();
  open(onShare);
  const entry = await screen.findByTestId('history-workout-1');
  expect(screen.queryByRole('button', { name: /Share.*to feed/i })).toBeNull();
  expect(trainingApi.session).not.toHaveBeenCalled();
  fireEvent.press(entry);
  expect(await screen.findByRole('header', { name: 'Workout detail' })).toBeTruthy();
  expect(await screen.findByText('1 h')).toBeTruthy();
  fireEvent.press(await screen.findByRole('button', { name: 'Share to feed' }));
  expect(onShare).toHaveBeenCalledTimes(1);
  expect(onShare).toHaveBeenLastCalledWith(1);
  expect(await screen.findByRole('header', { name: 'Workout history' })).toBeTruthy();
});

test('without a share handler the history offers no share buttons', async () => {
  jest.mocked(trainingApi.sessions).mockResolvedValue({ items: [session], limit: 50, offset: 0 });
  jest.mocked(trainingApi.session).mockResolvedValue(session);
  open();
  const entry = await screen.findByTestId('history-workout-1');
  expect(screen.queryByRole('button', { name: /Share.*to feed/i })).toBeNull();
  fireEvent.press(entry);
  expect(await screen.findByText('1. Bench press')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Share to feed' })).toBeNull();
});
