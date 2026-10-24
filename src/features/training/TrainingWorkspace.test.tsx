import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TrainingWorkspace } from './TrainingWorkspace';
import { trainingApi } from './api';
import { exampleExercise, exampleRoutine } from './fixtures';

jest.mock('react-native-draggable-flatlist', () => {
  const { FlatList } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      renderItem,
      ...props
    }: import('react-native-draggable-flatlist').DraggableFlatListProps<unknown>) => (
      <FlatList
        {...props}
        renderItem={({ item, index }: { item: unknown; index: number }) =>
          renderItem({ item, getIndex: () => index, drag: jest.fn(), isActive: false })
        }
      />
    ),
  };
});
jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn(),
  VideoView: jest.requireActual('react-native').View,
}));
jest.mock('expo-network', () => ({
  useNetworkState: () => ({ isConnected: true, isInternetReachable: true }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('./api', () => ({
  trainingApi: {
    routines: jest.fn(),
    routine: jest.fn(),
    exercises: jest.fn(),
    exercise: jest.fn(),
    bodyParts: jest.fn(),
    save: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(trainingApi.routines)
    .mockResolvedValue({ items: [{ id: 10, name: 'Push' }], limit: 20, offset: 0 });
  jest.mocked(trainingApi.routine).mockResolvedValue(exampleRoutine);
  jest
    .mocked(trainingApi.exercises)
    .mockResolvedValue({ items: [exampleExercise], limit: 20, offset: 0 });
  jest.mocked(trainingApi.exercise).mockResolvedValue(exampleExercise);
  jest.mocked(trainingApi.bodyParts).mockResolvedValue({ items: ['CHEST', 'UPPER ARMS'] });
  jest.mocked(trainingApi.save).mockResolvedValue(exampleRoutine);
});

test('loads and edits saved defaults, retains input on failure, then saves with slot identity', async () => {
  jest
    .mocked(trainingApi.save)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(exampleRoutine);
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByLabelText('Edit Push'));
  const name = await screen.findByLabelText('Routine name');
  fireEvent.changeText(name, 'Updated push');
  expect(screen.getByText('1 set')).toBeTruthy();
  expect(screen.queryByLabelText('Exercise 1 set 1 kg')).toBeNull();
  fireEvent.press(screen.getByLabelText('Edit sets for Bench press'));
  expect(screen.getByLabelText('Exercise 1 set 1 kg').props.value).toBe('80.00');
  expect(screen.getByLabelText('Exercise 1 set 1 reps').props.value).toBe('8');
  fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 kg'), '82.50');
  fireEvent.press(screen.getByText('Done'));
  await screen.findByText('8 reps · 82.5 kg');
  fireEvent.press(screen.getByText('Save'));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Routine name').props.value).toBe('Updated push');
  expect(screen.getByText('8 reps · 82.5 kg')).toBeTruthy();
  expect(trainingApi.save).toHaveBeenCalledTimes(1);
  expect(trainingApi.save).toHaveBeenCalledWith(
    {
      name: 'Updated push',
      exercises: [{ id: 20, exercise_id: 1, sets: [{ reps: 8, weight_kg: '82.50' }] }],
    },
    10,
  );
  fireEvent.press(screen.getByText('Save'));
  await screen.findByText('Routine saved.');
});

test('creates a routine by selecting exercises, filtering body-parts and adding valid kg/reps sets', async () => {
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByText('New routine'));
  fireEvent.changeText(screen.getByLabelText('Routine name'), 'New push');
  fireEvent.press(screen.getByText('Add exercise'));
  await screen.findByLabelText('Add Bench press');
  fireEvent.press(screen.getByLabelText('Filter body parts'));
  fireEvent.press(await screen.findByRole('checkbox', { name: 'CHEST' }));
  fireEvent.press(screen.getByLabelText('Save filters'));
  await waitFor(() =>
    expect(trainingApi.exercises).toHaveBeenCalledWith(['CHEST'], 0, expect.anything(), ''),
  );
  fireEvent.press(await screen.findByLabelText('Add Bench press'));
  fireEvent.press(screen.getByLabelText('Edit sets for Bench press'));
  fireEvent.press(screen.getByLabelText('Add set to exercise 1'));
  fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 kg'), '80.001');
  fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 reps'), '8');
  fireEvent.press(screen.getByText('Done'));
  await screen.findByText('Enter nonnegative kg, up to two decimals.');
  expect(trainingApi.save).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 kg'), '80');
  fireEvent.press(screen.getByText('Done'));
  await screen.findByLabelText('Routine name');
  fireEvent.press(screen.getByText('Save'));
  await screen.findByText('Routine saved.');
  expect(trainingApi.save).toHaveBeenCalledWith(
    { name: 'New push', exercises: [{ exercise_id: 1, sets: [{ reps: 8, weight_kg: '80' }] }] },
    undefined,
  );
});

test('cancel confirms dirty changes and account changes discard private forms and queries', async () => {
  const view = render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByLabelText('Edit Push'));
  fireEvent.changeText(await screen.findByLabelText('Routine name'), 'Private draft');
  fireEvent.press(screen.getByLabelText('Back to routines'));
  expect(screen.getByText('Discard your unsaved changes?')).toBeTruthy();
  expect(screen.getByTestId('discard-backdrop').props.style.backgroundColor).toBeTruthy();
  fireEvent.press(screen.getByText('Keep editing'));
  expect(screen.getByLabelText('Routine name').props.value).toBe('Private draft');
  jest.mocked(trainingApi.routines).mockResolvedValue({ items: [], limit: 20, offset: 0 });
  view.rerender(<TrainingWorkspace accountId={2} onSignOut={jest.fn()} />);
  await screen.findByText('Your next workout starts here.');
  expect(screen.queryByLabelText('Routine name')).toBeNull();
  expect(screen.queryByText('Push')).toBeNull();
});

test('unmount cancels pending private reads and ignores late results', async () => {
  let finish: (value: Awaited<ReturnType<typeof trainingApi.routines>>) => void = () => {};
  jest.mocked(trainingApi.routines).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  await waitFor(() => expect(trainingApi.routines).toHaveBeenCalled());
  const signal = jest.mocked(trainingApi.routines).mock.calls[0][1];
  view.unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    finish({ items: [{ id: 10, name: 'Late private routine' }], limit: 20, offset: 0 });
  });
});

test('body-part chips and debounced name search compose, clear and reset pagination', async () => {
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByText('New routine'));
  fireEvent.press(screen.getByText('Add exercise'));
  fireEvent.press(screen.getByLabelText('Filter body parts'));
  fireEvent.press(await screen.findByRole('checkbox', { name: 'UPPER ARMS' }));
  fireEvent.press(screen.getByLabelText('Save filters'));
  fireEvent.changeText(screen.getByLabelText('Search exercises'), ' Press & fly ');
  await waitFor(() =>
    expect(trainingApi.exercises).toHaveBeenLastCalledWith(
      ['UPPER ARMS'],
      0,
      expect.anything(),
      'Press & fly',
    ),
  );
  fireEvent.press(screen.getByLabelText('Remove UPPER ARMS filter'));
  await waitFor(() =>
    expect(trainingApi.exercises).toHaveBeenLastCalledWith([], 0, expect.anything(), 'Press & fly'),
  );
  fireEvent.changeText(screen.getByLabelText('Search exercises'), '');
  await waitFor(() =>
    expect(trainingApi.exercises).toHaveBeenLastCalledWith([], 0, expect.anything(), ''),
  );
});

test('routine cards show images and open on-demand details without losing draft input', async () => {
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByLabelText('Edit Push'));
  fireEvent.changeText(await screen.findByLabelText('Routine name'), 'Private draft');
  expect(screen.getByLabelText('Bench press').props.source).toEqual({
    uri: exampleExercise.image_url,
  });
  fireEvent.press(screen.getByLabelText('Details for Bench press'));
  await screen.findByText('1. Lower, then press.');
  expect(trainingApi.exercise).toHaveBeenCalledWith(1, expect.anything());
  fireEvent.press(screen.getByLabelText('Back'));
  expect(screen.getByLabelText('Routine name').props.value).toBe('Private draft');
});

test('drag completion preserves stable slot identities and edited sets in the saved order', async () => {
  const second = {
    ...exampleRoutine.exercises[0],
    id: 21,
    exercise_order: 2,
    exercise: { ...exampleExercise, id: 2, name: 'Row' },
    default_sets: [],
  };
  jest
    .mocked(trainingApi.routine)
    .mockResolvedValue({ ...exampleRoutine, exercises: [...exampleRoutine.exercises, second] });
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByLabelText('Edit Push'));
  fireEvent.press(await screen.findByLabelText('Edit sets for Bench press'));
  fireEvent.changeText(await screen.findByLabelText('Exercise 1 set 1 kg'), '82.50');
  expect(screen.queryByText('CHEST')).toBeNull();
  fireEvent.press(screen.getByText('Done'));
  await screen.findByLabelText('Routine name');
  expect(screen.queryByText('↑ Up')).toBeNull();
  expect(screen.getByLabelText('Reorder Bench press')).toBeTruthy();
  fireEvent(screen.getByTestId('routine-exercises'), 'dragEnd', { from: 0, to: 1 });
  fireEvent.press(screen.getByLabelText('Edit sets for Bench press'));
  expect(screen.getByLabelText('Exercise 2 set 1 kg').props.value).toBe('82.50');
  fireEvent.press(screen.getByLabelText('Back to routine'));
  fireEvent.press(screen.getByText('Save'));
  await waitFor(() =>
    expect(trainingApi.save).toHaveBeenCalledWith(
      {
        name: 'Push',
        exercises: [
          { id: 21, exercise_id: 2, sets: [] },
          { id: 20, exercise_id: 1, sets: [{ reps: 8, weight_kg: '82.50' }] },
        ],
      },
      10,
    ),
  );
});

test('empty summary pages are explicit while routines can search by name', async () => {
  jest.mocked(trainingApi.exercises).mockResolvedValue({ items: [], limit: 20, offset: 0 });
  const view = render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.changeText(await screen.findByLabelText('Search routines'), ' Push ');
  await waitFor(() =>
    expect(trainingApi.routines).toHaveBeenLastCalledWith(0, expect.anything(), 'Push'),
  );
  fireEvent.press(screen.getByText('New routine'));
  fireEvent.press(screen.getByText('Add exercise'));
  await screen.findByText('No exercises found. Try another name or body part.');
  view.unmount();
});

test('body-part option failure permits browsing and retries from the filter modal', async () => {
  jest.mocked(trainingApi.bodyParts).mockRejectedValue(new Error('unavailable'));
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByText('New routine'));
  fireEvent.press(screen.getByText('Add exercise'));
  await screen.findByLabelText('Add Bench press');
  fireEvent.press(screen.getByLabelText('Filter body parts'));
  await screen.findByRole('alert', {}, { timeout: 4000 });
  jest.mocked(trainingApi.bodyParts).mockResolvedValue({ items: ['CHEST'] });
  fireEvent.press(screen.getByText('Retry'));
  await screen.findByRole('checkbox', { name: 'CHEST' });
});

test('overview summarises varied sets and set editor retains changes across back navigation', async () => {
  jest.mocked(trainingApi.routine).mockResolvedValue({
    ...exampleRoutine,
    exercises: [
      {
        ...exampleRoutine.exercises[0],
        default_sets: [
          {
            ...exampleRoutine.exercises[0].default_sets[0],
            set_number: 1,
            reps: 8,
            weight_kg: '40.00',
          },
          {
            ...exampleRoutine.exercises[0].default_sets[0],
            set_number: 2,
            reps: 12,
            weight_kg: '60.00',
          },
        ],
      },
    ],
  });
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByLabelText('Edit Push'));
  await screen.findByText('2 sets');
  expect(screen.getByText('8–12 reps · 40–60 kg')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Edit sets for Bench press'));
  expect(screen.queryByText('PECTORALIS')).toBeNull();
  expect(screen.queryByText('CHEST')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Exercise 1 set 2 kg'), '65');
  fireEvent.press(screen.getByLabelText('Back to routine'));
  expect(screen.getByText('8–12 reps · 40–65 kg')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Edit sets for Bench press'));
  expect(screen.getByLabelText('Exercise 1 set 2 kg').props.value).toBe('65');
  fireEvent.press(screen.getByLabelText('Remove set 2 from exercise 1'));
  fireEvent.press(screen.getByText('Done'));
  await screen.findByText('1 set');
  fireEvent.press(screen.getByLabelText('Edit sets for Bench press'));
  fireEvent.press(screen.getByLabelText('Remove Bench press'));
  expect(screen.queryByLabelText('Edit sets for Bench press')).toBeNull();
});

test('multi-select filters apply only on Save, support cancel, badges and clearing', async () => {
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByText('New routine'));
  fireEvent.press(screen.getByText('Add exercise'));
  await screen.findByLabelText('Add Bench press');
  fireEvent.press(screen.getByLabelText('Filter body parts'));
  fireEvent.press(await screen.findByRole('checkbox', { name: 'CHEST' }));
  fireEvent.press(screen.getByRole('checkbox', { name: 'UPPER ARMS' }));
  expect(trainingApi.exercises).toHaveBeenLastCalledWith([], 0, expect.anything(), '');
  fireEvent.press(screen.getByLabelText('Save filters'));
  await waitFor(() =>
    expect(trainingApi.exercises).toHaveBeenLastCalledWith(
      ['CHEST', 'UPPER ARMS'],
      0,
      expect.anything(),
      '',
    ),
  );
  expect(screen.getByLabelText('Remove CHEST filter')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Filter body parts'));
  expect(screen.getByRole('checkbox', { name: 'CHEST' }).props.accessibilityState.checked).toBe(
    true,
  );
  fireEvent.press(screen.getByRole('checkbox', { name: 'CHEST' }));
  fireEvent.press(screen.getByText('Cancel'));
  expect(screen.getByLabelText('Remove CHEST filter')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Remove CHEST filter'));
  await waitFor(() =>
    expect(trainingApi.exercises).toHaveBeenLastCalledWith(
      ['UPPER ARMS'],
      0,
      expect.anything(),
      '',
    ),
  );
  fireEvent.press(screen.getByLabelText('Filter body parts'));
  fireEvent.press(screen.getByText('Clear'));
  fireEvent.press(screen.getByLabelText('Save filters'));
  await waitFor(() =>
    expect(trainingApi.exercises).toHaveBeenLastCalledWith([], 0, expect.anything(), ''),
  );
});

test('end of list automatically fetches once while pending and stops after a short page', async () => {
  let finish: (value: Awaited<ReturnType<typeof trainingApi.exercises>>) => void = () => {};
  jest.mocked(trainingApi.exercises).mockImplementation((_parts, offset) =>
    offset === 0
      ? Promise.resolve({
          items: [exampleExercise, { ...exampleExercise, id: 2, name: 'Row' }],
          limit: 2,
          offset: 0,
        })
      : new Promise((resolve) => {
          finish = resolve;
        }),
  );
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByText('New routine'));
  fireEvent.press(screen.getByText('Add exercise'));
  await screen.findByLabelText('Add Row');
  fireEvent(screen.getByTestId('exercise-catalogue'), 'endReached');
  await waitFor(() =>
    expect(trainingApi.exercises).toHaveBeenCalledWith([], 2, expect.anything(), ''),
  );
  fireEvent(screen.getByTestId('exercise-catalogue'), 'endReached');
  expect(trainingApi.exercises).toHaveBeenCalledTimes(2);
  await act(async () => {
    finish({ items: [{ ...exampleExercise, id: 3, name: 'Squat' }], limit: 2, offset: 2 });
  });
  await screen.findByLabelText('Add Squat');
  fireEvent(screen.getByTestId('exercise-catalogue'), 'endReached');
  expect(trainingApi.exercises).toHaveBeenCalledTimes(2);
  expect(screen.queryByText('More')).toBeNull();
});

test('failed automatic page fetch retains results and waits for explicit retry', async () => {
  jest
    .mocked(trainingApi.exercises)
    .mockImplementation((_parts, offset) =>
      offset === 0
        ? Promise.resolve({ items: [exampleExercise], limit: 1, offset: 0 })
        : Promise.reject(new Error('offline')),
    );
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByText('New routine'));
  fireEvent.press(screen.getByText('Add exercise'));
  await screen.findByLabelText('Add Bench press');
  fireEvent(screen.getByTestId('exercise-catalogue'), 'endReached');
  await screen.findByText('Retry', {}, { timeout: 4000 });
  expect(screen.getByLabelText('Add Bench press')).toBeTruthy();
  const attempts = jest.mocked(trainingApi.exercises).mock.calls.length;
  fireEvent(screen.getByTestId('exercise-catalogue'), 'endReached');
  expect(trainingApi.exercises).toHaveBeenCalledTimes(attempts);
  jest.mocked(trainingApi.exercises).mockResolvedValue({ items: [], limit: 1, offset: 1 });
  fireEvent.press(screen.getByText('Retry'));
  await waitFor(() => expect(screen.queryByText('Retry')).toBeNull());
});
