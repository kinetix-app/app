import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExerciseDetails } from '../components/ExerciseDetails';
import { trainingApi } from '../api';
import { exampleExercise } from './fixtures';
import { ApiError } from '@/services/apiClient';
import { Failure } from '../components/ui';

jest.mock('@expo/vector-icons', () => ({ Feather: 'Icon' }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('../components/ExerciseMedia', () => ({ ExerciseMedia: () => null }));
jest.mock('../api', () => ({ trainingApi: { exercise: jest.fn() } }));
beforeEach(() => jest.resetAllMocks());
function open(onAdd?: React.ComponentProps<typeof ExerciseDetails>['onAdd']) {
  const onClose = jest.fn();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}
    >
      <ExerciseDetails accountId={1} exerciseId={1} onAdd={onAdd} onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}
test('retries failed detail loading and adds the loaded exercise', async () => {
  jest
    .mocked(trainingApi.exercise)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(exampleExercise);
  const add = jest.fn();
  const close = open(add);
  fireEvent.press(await screen.findByText('Retry'));
  expect(await screen.findByText('1. Lower, then press.')).toBeTruthy();
  expect(screen.getByText('Equipment: BARBELL')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Add Bench press'));
  expect(add).toHaveBeenCalledWith(exampleExercise);
  fireEvent.press(screen.getByLabelText('Back'));
  expect(close).toHaveBeenCalledTimes(1);
});
test('shows missing instructions without offering an add action in read-only details', async () => {
  jest
    .mocked(trainingApi.exercise)
    .mockResolvedValue({ ...exampleExercise, overview: null, equipments: [], instructions: [] });
  open();
  expect(await screen.findByText('No instructions available.')).toBeTruthy();
  expect(screen.queryByLabelText('Add Bench press')).toBeNull();
  expect(screen.queryByText('Equipment: BARBELL')).toBeNull();
});
test.each([
  [401, 'Your account cannot access this data. Sign out and sign in again.'],
  [403, 'Your account cannot access this data. Sign out and sign in again.'],
  [404, 'This routine or exercise is no longer available.'],
  [422, 'Some fields or exercises are unavailable. Check your selection and try again.'],
  [503, 'Could not connect or read the response. Your changes are still here. Try again.'],
])('explains API error %s without a retry when none is provided', (status, message) => {
  render(<Failure error={new ApiError(status, 'failure')} />);
  expect(screen.getByRole('alert')).toHaveTextContent(message);
  expect(screen.queryByText('Retry')).toBeNull();
});
