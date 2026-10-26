import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TrainingWorkspace as Workspace } from '../components/TrainingWorkspace';
import { PrivateQueryProvider } from '@/providers/PrivateQueryProvider';
import { SessionProvider } from '../components/SessionProvider';
import { SessionHost } from '../components/SessionHost';

import { trainingApi } from '../api';
import { exampleExercise, exampleRoutine } from './fixtures';

function TrainingWorkspace(props: { accountId: number; onSignOut: () => void }) {
  return (
    <PrivateQueryProvider key={props.accountId}>
      <SessionProvider {...props}>
        <SessionHost>
          <Workspace accountId={props.accountId} />
        </SessionHost>
      </SessionProvider>
    </PrivateQueryProvider>
  );
}

jest.mock(
  '@react-native-async-storage/async-storage',
  () => ({
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  }),
  { virtual: true },
);

jest.mock('expo-crypto', () => {
  let sequence = 0;
  return { randomUUID: () => `3e17c183-38a9-4b5c-b953-${String(++sequence).padStart(12, '0')}` };
});

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
          renderItem({
            item,
            getIndex: () => index,
            drag: jest.fn(),
            isActive: false,
          })
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
jest.mock('../api', () => ({
  trainingApi: {
    complete: jest.fn(),
    draft: jest.fn(),
    saveDraft: jest.fn(),
    finishDraft: jest.fn(),
    discardDraft: jest.fn(),
    sessions: jest.fn(),
    session: jest.fn(),
    routines: jest.fn(),
    routine: jest.fn(),
    exercises: jest.fn(),
    exercise: jest.fn(),
    lastConfiguration: jest.fn(),
    bodyParts: jest.fn(),
    save: jest.fn(),
  },
}));

function collapseExercise() {
  const expanded = screen
    .getAllByLabelText(/^Edit sets for /)
    .find((button) => button.props.accessibilityState.expanded);
  if (!expanded) throw new Error('No exercise is expanded.');
  fireEvent.press(expanded);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(trainingApi.draft).mockResolvedValue(null);
  jest.mocked(trainingApi.saveDraft).mockImplementation(async (id, snapshot) => ({
    ...snapshot,
    client_session_id: id,
    state: 'draft',
  }));
  jest.mocked(trainingApi.discardDraft).mockResolvedValue();
  jest.mocked(trainingApi.lastConfiguration).mockResolvedValue({ exercise_id: 1, sets: [] });
  jest.mocked(trainingApi.routines).mockResolvedValue({
    items: [{ id: 10, name: 'Push' }],
    limit: 20,
    offset: 0,
  });
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
  collapseExercise();
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
  fireEvent.press(screen.getByText('Save'));
  await screen.findByText('Enter nonnegative kg, up to two decimals.');
  expect(trainingApi.save).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 kg'), '80');
  collapseExercise();
  await screen.findByLabelText('Routine name');
  fireEvent.press(screen.getByText('Save'));
  await screen.findByText('Routine saved.');
  expect(trainingApi.save).toHaveBeenCalledWith(
    {
      name: 'New push',
      exercises: [{ exercise_id: 1, sets: [{ reps: 8, weight_kg: '80' }] }],
    },
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
    finish({
      items: [{ id: 10, name: 'Late private routine' }],
      limit: 20,
      offset: 0,
    });
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
  jest.mocked(trainingApi.routine).mockResolvedValue({
    ...exampleRoutine,
    exercises: [...exampleRoutine.exercises, second],
  });
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByLabelText('Edit Push'));
  await waitFor(() =>
    expect(
      screen.getByLabelText('Edit sets for Bench press').props.accessibilityState.disabled,
    ).toBe(false),
  );
  fireEvent.press(screen.getByLabelText('Edit sets for Bench press'));
  fireEvent.changeText(await screen.findByLabelText('Exercise 1 set 1 kg'), '82.50');
  expect(screen.queryByText('CHEST')).toBeNull();
  collapseExercise();
  await screen.findByLabelText('Routine name');
  expect(screen.queryByText('↑ Up')).toBeNull();
  expect(screen.getByLabelText('Reorder Bench press')).toBeTruthy();
  fireEvent(screen.getByTestId('routine-exercises'), 'dragEnd', {
    from: 0,
    to: 1,
  });
  fireEvent.press(screen.getByLabelText('Edit sets for Bench press'));
  expect(screen.getByLabelText('Exercise 2 set 1 kg').props.value).toBe('82.50');
  collapseExercise();
  fireEvent.press(await screen.findByText('Save'));
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
  expect(await screen.findByRole('checkbox', { name: 'CHEST' })).toBeTruthy();
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
  collapseExercise();
  await waitFor(() =>
    expect(
      screen.getByLabelText('Edit sets for Bench press').props.accessibilityState.expanded,
    ).toBe(false),
  );
  expect(screen.getByText('8–12 reps · 40–65 kg')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Edit sets for Bench press'));
  expect(screen.getByLabelText('Exercise 1 set 2 kg').props.value).toBe('65');
  fireEvent.press(screen.getByLabelText('Remove set 2 from exercise 1'));
  collapseExercise();
  await waitFor(() =>
    expect(
      screen.getByLabelText('Edit sets for Bench press').props.accessibilityState.expanded,
    ).toBe(false),
  );
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
    finish({
      items: [{ ...exampleExercise, id: 3, name: 'Squat' }],
      limit: 2,
      offset: 2,
    });
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

test('routine start snapshots guidance with empty actual results, minimize resumes original values and finish retries the same body', async () => {
  jest
    .mocked(trainingApi.finishDraft)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({} as Awaited<ReturnType<typeof trainingApi.finishDraft>>);
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByLabelText('Edit Push'));
  fireEvent.press(await screen.findByText('Start routine'));
  await waitFor(() =>
    expect(
      screen.getByLabelText('Edit sets for Bench press').props.accessibilityState.disabled,
    ).toBe(false),
  );
  fireEvent.press(screen.getByLabelText('Edit sets for Bench press'));
  expect(screen.getByLabelText('Exercise 1 set 1 kg').props.value).toBe('');
  expect(screen.getByLabelText('Exercise 1 set 1 reps').props.value).toBe('');
  expect(trainingApi.complete).not.toHaveBeenCalled();
  expect(trainingApi.save).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Display weight in lb')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 kg'), '100.00');
  fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 reps'), '8');
  expect(screen.getByLabelText('Exercise 1 set 1 kg').props.value).toBe('100.00');
  collapseExercise();
  fireEvent.press(screen.getByLabelText('Minimize workout'));
  await screen.findByLabelText('Resume workout');
  expect(
    screen.getByRole('button', { name: 'Start workout' }).props.accessibilityState.disabled,
  ).toBe(true);
  fireEvent.press(screen.getByLabelText('Resume workout'));
  await waitFor(() =>
    expect(
      screen.getByLabelText('Edit sets for Bench press').props.accessibilityState.disabled,
    ).toBe(false),
  );
  fireEvent.press(screen.getByLabelText('Edit sets for Bench press'));
  expect(screen.getByLabelText('Exercise 1 set 1 kg').props.value).toBe('100.00');
  fireEvent.press(screen.getByLabelText('Save exercise 1 set 1'));
  await waitFor(() =>
    expect(
      screen.getByLabelText('Edit sets for Bench press').props.accessibilityState.expanded,
    ).toBe(false),
  );
  fireEvent.press(screen.getByText('Finish'));
  expect(screen.getByText('Update the routine?')).toBeTruthy();
  expect(trainingApi.finishDraft).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Keep routine'));
  await screen.findByText('Retry Finish');
  const body = jest.mocked(trainingApi.finishDraft).mock.calls[0].slice(0, 2);
  expect(
    jest.mocked(trainingApi.saveDraft).mock.calls.at(-1)?.[1].exercises[0].sets[0],
  ).toMatchObject({ reps: 8, weight: { value: '100.00', unit: 'kg' }, completed: true });
  fireEvent.press(screen.getByText('Retry Finish'));
  await screen.findByText('Start workout');
  expect(jest.mocked(trainingApi.finishDraft).mock.calls[1].slice(0, 2)).toEqual(body);
});

test('routine save preserves canonical precision while unit toggles create no writes', async () => {
  jest.mocked(trainingApi.routine).mockResolvedValue({
    ...exampleRoutine,
    exercises: [
      {
        ...exampleRoutine.exercises[0],
        default_sets: [
          {
            ...exampleRoutine.exercises[0].default_sets[0],
            weight_kg: '45.359237',
            weight: { value: '45.36', unit: 'kg' },
          },
        ],
      },
    ],
  });
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByLabelText('Edit Push'));
  await waitFor(() =>
    expect(
      screen.getByLabelText('Edit sets for Bench press').props.accessibilityState.disabled,
    ).toBe(false),
  );
  fireEvent.press(screen.getByLabelText('Edit sets for Bench press'));
  expect(screen.getByLabelText('Exercise 1 set 1 kg').props.value).toBe('45.36');
  expect(screen.queryByLabelText('Display weight in lb')).toBeNull();
  expect(trainingApi.save).not.toHaveBeenCalled();
  collapseExercise();
  fireEvent.press(await screen.findByText('Save'));
  await waitFor(() =>
    expect(trainingApi.save).toHaveBeenCalledWith(
      expect.objectContaining({
        exercises: [{ id: 20, exercise_id: 1, sets: [{ reps: 8, weight_kg: '45.359237' }] }],
      }),
      10,
    ),
  );
});

test('dirty routine must save before local start and a failed save retains the form', async () => {
  jest
    .mocked(trainingApi.save)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(exampleRoutine);
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByLabelText('Edit Push'));
  fireEvent.changeText(await screen.findByLabelText('Routine name'), 'Changed');
  fireEvent.press(screen.getByText('Start routine'));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Routine name').props.value).toBe('Changed');
  expect(screen.queryByText('Finish')).toBeNull();
  fireEvent.press(screen.getByText('Start routine'));
  await screen.findByText('Finish');
  expect(trainingApi.save).toHaveBeenCalledTimes(2);
  expect(trainingApi.complete).not.toHaveBeenCalled();
});

test('resuming a minimized workout preserves unsaved routine edits beneath the workout', async () => {
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByText('Start workout'));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Minimize workout' }).props.accessibilityState.disabled,
    ).toBe(false),
  );
  fireEvent.press(screen.getByLabelText('Minimize workout'));
  fireEvent.press(await screen.findByLabelText('Edit Push'));
  fireEvent.changeText(await screen.findByLabelText('Routine name'), 'Private unsaved name');
  expect(
    screen.getByRole('button', { name: 'Start routine' }).props.accessibilityState.disabled,
  ).toBe(true);
  fireEvent.press(screen.getByLabelText('Resume workout'));
  await screen.findByText('Finish');
  fireEvent.press(screen.getByLabelText('Minimize workout'));
  expect((await screen.findByLabelText('Routine name')).props.value).toBe('Private unsaved name');
  expect(trainingApi.save).not.toHaveBeenCalled();
});

test('saved routine cards expose Edit and Start and direct start refreshes cached guidance with empty results', async () => {
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  expect(await screen.findByRole('button', { name: 'Edit Push' })).toBeTruthy();
  expect(screen.getByText('Edit')).toBeTruthy();
  expect(screen.getByText('Start')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Edit Push'));
  await screen.findByLabelText('Routine name');
  fireEvent.press(screen.getByLabelText('Back to routines'));
  jest.mocked(trainingApi.routine).mockResolvedValue({
    ...exampleRoutine,
    exercises: [
      {
        ...exampleRoutine.exercises[0],
        exercise: { ...exampleExercise, name: 'Updated bench' },
      },
    ],
  });
  fireEvent.press(await screen.findByLabelText('Start Push'));
  await waitFor(() =>
    expect(
      screen.getByLabelText('Edit sets for Updated bench').props.accessibilityState.disabled,
    ).toBe(false),
  );
  fireEvent.press(screen.getByLabelText('Edit sets for Updated bench'));
  expect(trainingApi.routine).toHaveBeenCalledTimes(2);
  expect(trainingApi.routine).toHaveBeenLastCalledWith(10, expect.anything());
  expect(screen.getByLabelText('Exercise 1 set 1 kg').props.value).toBe('');
  expect(screen.getByLabelText('Exercise 1 set 1 reps').props.value).toBe('');
  expect(trainingApi.save).not.toHaveBeenCalled();
  expect(trainingApi.complete).not.toHaveBeenCalled();
});

test('routine direct start guards concurrent taps and retries failed reads without entering a workout', async () => {
  let fail: (error: Error) => void = () => {};
  jest.mocked(trainingApi.routine).mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByLabelText('Start Push'));
  fireEvent.press(screen.getByLabelText('Start Push'));
  expect(screen.getByText('Starting…')).toBeTruthy();
  expect(screen.getByLabelText('Start Push').props.accessibilityState.disabled).toBe(true);
  expect(screen.getByLabelText('Edit Push').props.accessibilityState.disabled).toBe(false);
  expect(trainingApi.routine).toHaveBeenCalledTimes(1);
  await act(async () => fail(new Error('offline')));
  await screen.findByRole('alert');
  expect(screen.queryByText('Finish')).toBeNull();
  expect(screen.getByLabelText('Start Push').props.accessibilityState.disabled).toBe(false);
  fireEvent.press(screen.getByText('Retry'));
  await screen.findByLabelText('Edit sets for Bench press');
  expect(trainingApi.routine).toHaveBeenCalledTimes(2);
});

test('all starts remain disabled while an ongoing workout can only resume through its panel', async () => {
  jest.mocked(trainingApi.routines).mockResolvedValue({
    items: [
      { id: 10, name: 'Push' },
      { id: 11, name: 'Other routine' },
    ],
    limit: 20,
    offset: 0,
  });
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByLabelText('Start Push'));
  await waitFor(() =>
    expect(
      screen.getByLabelText('Edit sets for Bench press').props.accessibilityState.disabled,
    ).toBe(false),
  );
  fireEvent.press(screen.getByLabelText('Edit sets for Bench press'));
  fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 kg'), '85');
  fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 reps'), '9');
  collapseExercise();
  fireEvent.press(screen.getByLabelText('Minimize workout'));
  jest.mocked(trainingApi.routine).mockRejectedValue(new Error('offline'));
  expect(
    (await screen.findByLabelText('Start Other routine')).props.accessibilityState.disabled,
  ).toBe(true);
  expect(screen.getByLabelText('Start Push').props.accessibilityState.disabled).toBe(true);
  expect(
    screen.getByRole('button', { name: 'Start workout' }).props.accessibilityState.disabled,
  ).toBe(true);
  fireEvent.press(screen.getByLabelText('Resume workout'));
  await waitFor(() =>
    expect(
      screen.getByLabelText('Edit sets for Bench press').props.accessibilityState.disabled,
    ).toBe(false),
  );
  fireEvent.press(screen.getByLabelText('Edit sets for Bench press'));
  expect(screen.getByLabelText('Exercise 1 set 1 kg').props.value).toBe('85');
  expect(screen.getByLabelText('Exercise 1 set 1 reps').props.value).toBe('9');
  expect(trainingApi.routine).toHaveBeenCalledTimes(1);
});

test('pending routine start is cancelled on account change and cannot create a late private workout', async () => {
  let finish: (value: typeof exampleRoutine) => void = () => {};
  jest.mocked(trainingApi.routine).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByLabelText('Start Push'));
  const signal = jest.mocked(trainingApi.routine).mock.calls[0][1];
  view.rerender(<TrainingWorkspace accountId={2} onSignOut={jest.fn()} />);
  expect(signal?.aborted).toBe(true);
  await act(async () => finish(exampleRoutine));
  await screen.findByLabelText('Start Push');
  expect(screen.queryByText('Finish')).toBeNull();
  expect(screen.queryByLabelText('Resume workout')).toBeNull();
});

test('routine start waits for draft restoration and stays disabled after a storage failure', async () => {
  let fail: (error: Error) => void = () => {};
  jest.mocked(AsyncStorage.getItem).mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  const start = await screen.findByLabelText('Start Push');
  expect(start.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(start);
  expect(trainingApi.routine).not.toHaveBeenCalled();
  await act(async () => fail(new Error('storage unavailable')));
  await screen.findByText('Retry storage');
  expect(screen.getByLabelText('Start Push').props.accessibilityState.disabled).toBe(true);
  expect(screen.getByLabelText('Edit Push').props.accessibilityState.disabled).toBe(false);
  fireEvent.press(screen.getByText('Retry storage'));
  await waitFor(() =>
    expect(screen.getByLabelText('Start Push').props.accessibilityState.disabled).toBe(false),
  );
});

test('inline cards toggle without hiding the routine and the floating workout supports pull, discard confirmation and resume', async () => {
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByLabelText('Edit Push'));
  const expand = await screen.findByLabelText('Edit sets for Bench press');
  fireEvent.press(expand);
  expect(screen.getByLabelText('Routine name')).toBeTruthy();
  expect(screen.getByLabelText('Exercise 1 set 1 kg')).toBeTruthy();
  expect(screen.queryByLabelText('Display weight in lb')).toBeNull();
  fireEvent.press(expand);
  expect(screen.queryByLabelText('Exercise 1 set 1 kg')).toBeNull();
  fireEvent.press(screen.getByText('Start routine'));
  await waitFor(() =>
    expect(screen.getByLabelText('Minimize workout').props.accessibilityState.disabled).toBe(false),
  );
  expect(screen.queryByText(/^Started /)).toBeNull();
  fireEvent(screen.getByTestId('workout-pull-handle'), 'responderGrant', {
    nativeEvent: { pageY: 10 },
  });
  fireEvent(screen.getByTestId('workout-pull-handle'), 'responderRelease', {
    nativeEvent: { pageY: 100 },
  });
  expect(screen.getByLabelText('Resume workout')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Ongoing workout options'));
  expect(screen.getByText('Discard this workout?')).toBeTruthy();
  fireEvent.press(screen.getByText('Cancel'));
  fireEvent.press(screen.getByLabelText('Resume workout'));
  expect(screen.getByLabelText('Minimize workout')).toBeTruthy();
});

test('new session exercises load last recorded sets as placeholders while actual values remain empty', async () => {
  jest.mocked(trainingApi.lastConfiguration).mockResolvedValue({
    exercise_id: 1,
    sets: [
      exampleRoutine.exercises[0].sets[0],
      { ...exampleRoutine.exercises[0].sets[0], set_number: 2, weight_kg: '60.000000', reps: 6 },
    ],
  });
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByText('Start workout'));
  await waitFor(() =>
    expect(screen.getByLabelText('Minimize workout').props.accessibilityState.disabled).toBe(false),
  );
  fireEvent.press(screen.getByText('Add exercise'));
  fireEvent.press(await screen.findByLabelText('Add Bench press'));
  const weight = await screen.findByLabelText('Exercise 1 set 1 kg');
  expect(weight.props.value).toBe('');
  expect(weight.props.placeholder).toBe('90.00');
  expect(screen.getByLabelText('Exercise 1 set 1 reps').props.placeholder).toBe('12');
  expect(screen.getByLabelText('Exercise 1 set 2 kg').props.placeholder).toBe('60.00');
  expect(screen.getByLabelText('Exercise 1 set 2 reps').props.value).toBe('');
  expect(trainingApi.lastConfiguration).toHaveBeenCalledWith(1, expect.anything());
  fireEvent.press(screen.getByLabelText('Save exercise 1 set 1'));
  await screen.findByLabelText('Unsave exercise 1 set 1');
  expect(screen.getByLabelText('Exercise 1 set 1 kg').props.value).toBe('90.00');
  expect(screen.getByLabelText('Exercise 1 set 1 reps').props.value).toBe('12');
  expect(
    jest.mocked(trainingApi.saveDraft).mock.calls.at(-1)?.[1].exercises[0].sets[0],
  ).toMatchObject({
    completed: true,
    reps: 12,
    weight: { value: '90.00', unit: 'kg' },
  });
});
test('routine update prompt can cancel or finish with only saved sets and a frozen update choice', async () => {
  jest
    .mocked(trainingApi.finishDraft)
    .mockResolvedValueOnce({} as Awaited<ReturnType<typeof trainingApi.finishDraft>>);
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByLabelText('Start Push'));
  await waitFor(() =>
    expect(
      screen.getByLabelText('Edit sets for Bench press').props.accessibilityState.disabled,
    ).toBe(false),
  );
  fireEvent.press(screen.getByLabelText('Edit sets for Bench press'));
  fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 kg'), '75');
  fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 reps'), '7');
  fireEvent.press(screen.getByLabelText('Save exercise 1 set 1'));
  await waitFor(() =>
    expect(
      screen.getByLabelText('Edit sets for Bench press').props.accessibilityState.expanded,
    ).toBe(false),
  );
  fireEvent.press(screen.getByLabelText('Edit sets for Bench press'));
  await screen.findByLabelText('Unsave exercise 1 set 1');
  fireEvent.press(screen.getByLabelText('Add set to exercise 1'));
  fireEvent.changeText(screen.getByLabelText('Exercise 1 set 2 kg'), 'not valid');
  fireEvent.press(screen.getByText('Finish'));
  await screen.findByText('Update the routine?');
  fireEvent.press(screen.getByText('Cancel'));
  expect(trainingApi.finishDraft).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Exercise 1 set 2 kg').props.value).toBe('not valid');
  fireEvent.press(screen.getByText('Finish'));
  fireEvent.press(await screen.findByText('Update routine'));
  await waitFor(() =>
    expect(trainingApi.finishDraft).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.anything(),
      true,
    ),
  );
  expect(jest.mocked(trainingApi.saveDraft).mock.calls.at(-1)?.[1].exercises[0].sets).toHaveLength(
    1,
  );
  expect(trainingApi.save).not.toHaveBeenCalled();
});

test('saving the final outstanding set advances only after success; all completed cards collapse', async () => {
  const first = exampleRoutine.exercises[0];
  jest.mocked(trainingApi.routine).mockResolvedValue({
    ...exampleRoutine,
    exercises: [
      { ...first, sets: [first.sets[0], { ...first.sets[0], set_number: 2 }] },
      {
        ...first,
        id: 21,
        exercise_order: 2,
        exercise: { ...exampleExercise, id: 2, name: 'Squat' },
      },
    ],
  });
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByLabelText('Start Push'));
  await waitFor(() =>
    expect(
      screen.getByLabelText('Edit sets for Bench press').props.accessibilityState.disabled,
    ).toBe(false),
  );
  fireEvent.press(screen.getByLabelText('Edit sets for Bench press'));
  expect(screen.queryByText('Done')).toBeNull();
  for (let number = 1; number <= 2; number++) {
    fireEvent.changeText(screen.getByLabelText(`Exercise 1 set ${number} kg`), '80');
    fireEvent.changeText(screen.getByLabelText(`Exercise 1 set ${number} reps`), '8');
  }
  fireEvent.press(screen.getByLabelText('Save exercise 1 set 1'));
  await screen.findByLabelText('Unsave exercise 1 set 1');
  expect(screen.getByLabelText('Edit sets for Bench press').props.accessibilityState.expanded).toBe(
    true,
  );
  jest.mocked(trainingApi.saveDraft).mockRejectedValueOnce(new Error('offline'));
  fireEvent.press(screen.getByLabelText('Save exercise 1 set 2'));
  await screen.findByText(
    'Could not save the workout. Your changes are retained. Retry the tick or Sync workout.',
  );
  expect(screen.getByLabelText('Edit sets for Bench press').props.accessibilityState.expanded).toBe(
    true,
  );
  expect(screen.getByLabelText('Edit sets for Squat').props.accessibilityState.expanded).toBe(
    false,
  );
  fireEvent.press(screen.getByLabelText('Save exercise 1 set 2'));
  await waitFor(() =>
    expect(screen.getByLabelText('Edit sets for Squat').props.accessibilityState.expanded).toBe(
      true,
    ),
  );
  expect(screen.queryByLabelText('Exercise 1 set 1 kg')).toBeNull();
  expect(screen.getByLabelText('Exercise 2 set 1 kg').props.value).toBe('');
  fireEvent.press(screen.getByLabelText('Edit sets for Bench press'));
  fireEvent.press(screen.getByLabelText('Unsave exercise 1 set 2'));
  await screen.findByLabelText('Save exercise 1 set 2');
  expect(screen.getByLabelText('Edit sets for Bench press').props.accessibilityState.expanded).toBe(
    true,
  );
  fireEvent.press(screen.getByLabelText('Save exercise 1 set 2'));
  await waitFor(() =>
    expect(screen.getByLabelText('Edit sets for Squat').props.accessibilityState.expanded).toBe(
      true,
    ),
  );
  fireEvent.changeText(screen.getByLabelText('Exercise 2 set 1 kg'), '90');
  fireEvent.changeText(screen.getByLabelText('Exercise 2 set 1 reps'), '6');
  fireEvent.press(screen.getByLabelText('Save exercise 2 set 1'));
  await waitFor(() =>
    expect(screen.getByLabelText('Edit sets for Squat').props.accessibilityState.expanded).toBe(
      false,
    ),
  );
  expect(screen.queryByLabelText('Exercise 2 set 1 kg')).toBeNull();
});

test('completion skips finished exercises, wraps to earlier unfinished cards and collapses the last one', async () => {
  const first = exampleRoutine.exercises[0];
  const names = ['Bench press', 'Squat', 'Row', 'Lunge'];
  jest.mocked(trainingApi.routine).mockResolvedValue({
    ...exampleRoutine,
    exercises: names.map((name, index) => ({
      ...first,
      id: 20 + index,
      exercise_order: index + 1,
      exercise: { ...exampleExercise, id: index + 1, name },
    })),
  });
  render(<TrainingWorkspace accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByLabelText('Start Push'));
  await waitFor(() =>
    expect(
      screen.getByLabelText('Edit sets for Bench press').props.accessibilityState.disabled,
    ).toBe(false),
  );
  // Complete the third card out of order; the fourth becomes active.
  fireEvent.press(screen.getByLabelText('Edit sets for Row'));
  fireEvent.press(screen.getByLabelText('Save exercise 3 set 1'));
  await waitFor(() =>
    expect(screen.getByLabelText('Edit sets for Lunge').props.accessibilityState.expanded).toBe(
      true,
    ),
  );
  // Finishing the second skips the already completed third card.
  fireEvent.press(screen.getByLabelText('Edit sets for Squat'));
  fireEvent.press(screen.getByLabelText('Save exercise 2 set 1'));
  await waitFor(() =>
    expect(screen.getByLabelText('Edit sets for Lunge').props.accessibilityState.expanded).toBe(
      true,
    ),
  );
  // Completing the final card wraps around to the unfinished first card.
  fireEvent.press(screen.getByLabelText('Save exercise 4 set 1'));
  await waitFor(() =>
    expect(
      screen.getByLabelText('Edit sets for Bench press').props.accessibilityState.expanded,
    ).toBe(true),
  );
  fireEvent.press(screen.getByLabelText('Save exercise 1 set 1'));
  await waitFor(() =>
    expect(
      screen.getByLabelText('Edit sets for Bench press').props.accessibilityState.expanded,
    ).toBe(false),
  );
  expect(
    screen
      .getAllByLabelText(/^Edit sets for /)
      .every((button) => !button.props.accessibilityState.expanded),
  ).toBe(true);
});
