import React from 'react';
import { Text, View } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider, useSession } from '../components/SessionProvider';
import { Button } from '../ui';
import { sessionStorage } from '../sessionStorage';
import { trainingApi } from '../api';
import { exampleRoutine, exampleExercise } from '../fixtures';
import { createSessionDraft, draftSnapshot } from '../sessionDraft';
jest.mock(
  '@react-native-async-storage/async-storage',
  () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }),
  { virtual: true },
);
jest.mock('expo-crypto', () => {
  let i = 0;
  return { randomUUID: () => `3e17c183-38a9-4b5c-b953-${String(++i).padStart(12, '0')}` };
});
jest.mock('../api', () => ({
  trainingApi: {
    draft: jest.fn(),
    saveDraft: jest.fn(),
    finishDraft: jest.fn(),
    discardDraft: jest.fn(),
    exercise: jest.fn(),
    lastConfiguration: jest.fn(),
  },
}));
jest.mock('../sessionStorage', () => ({
  sessionStorage: { load: jest.fn(), save: jest.fn(), clear: jest.fn() },
}));
function Controls() {
  const session = useSession();
  return (
    <View>
      <Text>{session.ready ? 'ready' : 'loading'}</Text>
      <Text>{session.pending ? 'pending' : 'idle'}</Text>
      <Text testID="draft">{JSON.stringify(session.draft)}</Text>
      <Text>{session.error}</Text>
      <Button title="Start" onPress={() => session.start(exampleRoutine)} />
      <Button
        title="Edit"
        onPress={() =>
          session.change((value) => ({
            ...value,
            exercises: value.exercises.map((slot) => ({
              ...slot,
              sets: slot.sets.map((set) => ({ ...set, value: '100.00', unit: 'lb', reps: '8' })),
            })),
          }))
        }
      />
      <Button
        title="Tick"
        onPress={() => {
          const slot = session.draft?.exercises[0];
          if (slot) void session.saveSet(slot.id, slot.sets[0].id);
        }}
      />
      <Button
        title="Minimize"
        onPress={() => session.change((value) => ({ ...value, minimized: true }))}
      />
      <Button
        title="Add exercise"
        onPress={() => {
          void session.addExercise(exampleExercise);
        }}
      />
      <Button
        title="Add unfinished set"
        onPress={() =>
          session.change((value) => ({
            ...value,
            exercises: value.exercises.map((slot) => ({
              ...slot,
              sets: [...slot.sets, { id: 'unfinished', value: 'bad', reps: '', unit: 'kg' }],
            })),
          }))
        }
      />
      <Button
        title="Resume"
        onPress={() => session.change((value) => ({ ...value, minimized: false }))}
      />
      <Button
        title="Update and finish"
        onPress={() => {
          void session.finish(true);
        }}
      />
      <Button
        title="Finish"
        onPress={() => {
          void session.finish();
        }}
      />
      <Button
        title="Discard"
        onPress={() => {
          void session.discard();
        }}
      />
      <Button
        title="Sign out"
        onPress={() => {
          void session.signOut();
        }}
      />
    </View>
  );
}
function mount(onSignOut = jest.fn()) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
        })
      }
    >
      <SessionProvider accountId={1} onSignOut={onSignOut}>
        <Controls />
      </SessionProvider>
    </QueryClientProvider>,
  );
}
const draft = () => JSON.parse(screen.getByTestId('draft').props.children);
async function start() {
  await screen.findByText('ready');
  fireEvent.press(screen.getByText('Start'));
  await screen.findByText('idle');
}
async function record() {
  await start();
  fireEvent.press(screen.getByText('Edit'));
  fireEvent.press(screen.getByText('Tick'));
  await waitFor(() => expect(draft().exercises[0].sets[0].saved).toBe(true));
}
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(sessionStorage.load).mockResolvedValue(null);
  jest.mocked(sessionStorage.save).mockResolvedValue();
  jest.mocked(sessionStorage.clear).mockResolvedValue();
  jest.mocked(trainingApi.draft).mockResolvedValue(null);
  jest
    .mocked(trainingApi.saveDraft)
    .mockImplementation(async (id, value) => ({ ...value, client_session_id: id, state: 'draft' }));
  jest.mocked(trainingApi.exercise).mockResolvedValue(exampleExercise);
  jest.mocked(trainingApi.discardDraft).mockResolvedValue();
  jest.mocked(trainingApi.lastConfiguration).mockResolvedValue({ exercise_id: 1, sets: [] });
});
test('start persists a backend draft, tick saves actual values, minimize/resume preserves start', async () => {
  mount();
  await start();
  expect(trainingApi.saveDraft).toHaveBeenCalledTimes(1);
  expect(jest.mocked(trainingApi.saveDraft).mock.calls[0][1].exercises[0].sets[0]).toMatchObject({
    completed: false,
    reps: null,
    weight: null,
  });
  const original = draft();
  fireEvent.press(screen.getByText('Edit'));
  expect(trainingApi.saveDraft).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByText('Tick'));
  await waitFor(() => expect(draft().exercises[0].sets[0].saved).toBe(true));
  expect(jest.mocked(trainingApi.saveDraft).mock.calls[1][1].exercises[0].sets[0]).toMatchObject({
    completed: true,
    reps: 8,
    weight: { value: '100.00', unit: 'lb' },
  });
  fireEvent.press(screen.getByText('Minimize'));
  fireEvent.press(screen.getByText('Start'));
  expect(draft().minimized).toBe(true);
  fireEvent.press(screen.getByText('Resume'));
  expect(draft()).toMatchObject({
    clientId: original.clientId,
    startedAt: original.startedAt,
    minimized: false,
  });
});
test('failed tick keeps values unsaved and retry confirms only after success', async () => {
  mount();
  await start();
  jest.mocked(trainingApi.saveDraft).mockRejectedValueOnce(new Error('lost response'));
  fireEvent.press(screen.getByText('Edit'));
  fireEvent.press(screen.getByText('Tick'));
  await screen.findByText(
    'Could not save the workout. Your changes are retained. Retry the tick or Sync workout.',
  );
  expect(draft().exercises[0].sets[0]).toMatchObject({ value: '100.00', reps: '8' });
  expect(draft().exercises[0].sets[0].saved).not.toBe(true);
  fireEvent.press(screen.getByText('Tick'));
  await waitFor(() => expect(draft().exercises[0].sets[0].saved).toBe(true));
});
test('finish freezes the routine-update decision and retries without another PUT', async () => {
  jest
    .mocked(trainingApi.finishDraft)
    .mockRejectedValueOnce(new Error('lost response'))
    .mockResolvedValueOnce({} as Awaited<ReturnType<typeof trainingApi.finishDraft>>);
  mount();
  await start();
  fireEvent.press(screen.getByText('Edit'));
  fireEvent.press(screen.getByText('Tick'));
  await waitFor(() => expect(draft().exercises[0].sets[0].saved).toBe(true));
  fireEvent.press(screen.getByText('Update and finish'));
  await screen.findByText(
    'Could not finish the workout. Your results are retained. Retry Finish safely.',
  );
  const first = jest.mocked(trainingApi.finishDraft).mock.calls[0].slice(0, 2);
  const writes = jest.mocked(trainingApi.saveDraft).mock.calls.length;
  fireEvent.press(screen.getByText('Finish'));
  await waitFor(() => expect(draft()).toBeNull());
  expect(jest.mocked(trainingApi.finishDraft).mock.calls[1].slice(0, 2)).toEqual(first);
  expect(trainingApi.saveDraft).toHaveBeenCalledTimes(writes);
  expect(jest.mocked(trainingApi.finishDraft).mock.calls.map((call) => call[3])).toEqual([
    true,
    true,
  ]);
});
test('fresh device restores confirmed results from server and discards on server before local removal', async () => {
  const value = createSessionDraft(1, exampleRoutine);
  value.exercises[0].sets[0] = {
    ...value.exercises[0].sets[0],
    value: '85',
    reps: '9',
    saved: true,
  };
  jest.mocked(trainingApi.draft).mockResolvedValue({
    ...draftSnapshot(value),
    client_session_id: value.clientId,
    state: 'draft',
  });
  mount();
  await screen.findByText('ready');
  expect(draft()).toMatchObject({
    clientId: value.clientId,
    minimized: true,
    startedAt: value.startedAt,
  });
  expect(draft().exercises[0].sets[0]).toMatchObject({ value: '85', reps: '9', saved: true });
  jest.mocked(trainingApi.discardDraft).mockRejectedValueOnce(new Error('offline'));
  fireEvent.press(screen.getByText('Discard'));
  await screen.findByText('Could not discard the workout. It is retained; try again.');
  expect(sessionStorage.clear).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Discard'));
  await waitFor(() => expect(draft()).toBeNull());
});
test('logout clears device storage while retaining the server draft for next sign-in', async () => {
  const logout = jest.fn();
  mount(logout);
  await record();
  fireEvent.press(screen.getByText('Sign out'));
  await waitFor(() => expect(logout).toHaveBeenCalled());
  expect(sessionStorage.clear).toHaveBeenCalledWith(1);
  expect(trainingApi.discardDraft).not.toHaveBeenCalled();
});
test('late start response after unmount cannot overwrite private storage', async () => {
  let resolve: (value: Awaited<ReturnType<typeof trainingApi.saveDraft>>) => void = () => {};
  jest.mocked(trainingApi.saveDraft).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const view = mount();
  await screen.findByText('ready');
  fireEvent.press(screen.getByText('Start'));
  const value = draft();
  view.unmount();
  await act(async () =>
    resolve({ ...draftSnapshot(value), client_session_id: value.clientId, state: 'draft' }),
  );
  expect(sessionStorage.save).toHaveBeenCalledTimes(1);
});

test('a confirmed tick returns the set to a server draft, retains local values and can be saved again', async () => {
  mount();
  await record();
  fireEvent.press(screen.getByText('Tick'));
  await waitFor(() => expect(draft().exercises[0].sets[0].saved).toBe(false));
  expect(draft().exercises[0].sets[0]).toMatchObject({ value: '100.00', unit: 'lb', reps: '8' });
  expect(
    jest.mocked(trainingApi.saveDraft).mock.calls.at(-1)?.[1].exercises[0].sets[0],
  ).toMatchObject({ completed: false, reps: 8, weight: { value: '100.00', unit: 'lb' } });
  expect(draft().exercises[0].sets[0].confirmed).toBeUndefined();
  fireEvent.press(screen.getByText('Tick'));
  await waitFor(() => expect(draft().exercises[0].sets[0].saved).toBe(true));
});
test('failed untick retains the confirmed state until the server accepts the change', async () => {
  mount();
  await record();
  jest.mocked(trainingApi.saveDraft).mockRejectedValueOnce(new Error('offline'));
  fireEvent.press(screen.getByText('Tick'));
  await screen.findByText(
    'Could not save the workout. Your changes are retained. Retry the tick or Sync workout.',
  );
  expect(draft().exercises[0].sets[0].saved).toBe(true);
});

test('partial input is omitted from completion and the final saved snapshot', async () => {
  mount();
  await record();
  fireEvent.press(screen.getByText('Add unfinished set'));
  fireEvent.press(screen.getByText('Finish'));
  await waitFor(() => expect(draft()).toBeNull());
  const snapshot = jest.mocked(trainingApi.saveDraft).mock.calls.at(-1)?.[1];
  expect(snapshot?.exercises[0].sets).toHaveLength(1);
  expect(snapshot?.exercises[0].sets[0]).toMatchObject({ completed: true, reps: 8 });
  expect(trainingApi.finishDraft).toHaveBeenCalledTimes(1);
});
test('adding an exercise fetches only guidance and leaves its actual fields empty', async () => {
  jest
    .mocked(trainingApi.lastConfiguration)
    .mockResolvedValue({ exercise_id: 1, sets: exampleRoutine.exercises[0].sets });
  mount();
  await start();
  fireEvent.press(screen.getByText('Add exercise'));
  await waitFor(() => expect(draft().exercises).toHaveLength(2));
  expect(trainingApi.lastConfiguration).toHaveBeenCalledWith(1, expect.anything());
  expect(draft().exercises[1].guidance[0]).toMatchObject({ reps: 12, weightKg: '90.00' });
  expect(draft().exercises[1].sets[0]).toMatchObject({ value: '', reps: '', unit: 'kg' });
  expect(draft().exercises[1].sets[0].saved).not.toBe(true);
});
test('failed configuration lookup cannot append a blank duplicate and can be retried', async () => {
  jest.mocked(trainingApi.lastConfiguration).mockRejectedValueOnce(new Error('offline'));
  mount();
  await start();
  fireEvent.press(screen.getByText('Add exercise'));
  await screen.findByText('Could not load previous sets. Retry adding the exercise.');
  expect(draft().exercises).toHaveLength(1);
  fireEvent.press(screen.getByText('Add exercise'));
  await waitFor(() => expect(draft().exercises).toHaveLength(2));
});

test.each([
  ['', '', '90.00', '12'],
  ['75', '', '75', '12'],
  ['', '7', '90.00', '7'],
  ['0', '7', '0', '7'],
])(
  'tick fills only blank fields from guidance (%s, %s)',
  async (weight, reps, expectedWeight, expectedReps) => {
    const value = createSessionDraft(1, exampleRoutine);
    Object.assign(value.exercises[0].sets[0], { value: weight, reps });
    jest.mocked(sessionStorage.load).mockResolvedValue(value);
    mount();
    await screen.findByText('ready');
    fireEvent.press(screen.getByText('Tick'));
    await waitFor(() => expect(draft().exercises[0].sets[0].saved).toBe(true));
    expect(draft().exercises[0].sets[0]).toMatchObject({
      value: expectedWeight,
      reps: expectedReps,
      unit: 'kg',
    });
    expect(
      jest.mocked(trainingApi.saveDraft).mock.calls.at(-1)?.[1].exercises[0].sets[0],
    ).toMatchObject({
      completed: true,
      reps: Number(expectedReps),
      weight: { value: expectedWeight, unit: 'kg' },
    });
  },
);

test.each(['no guidance', 'missing reps', 'invalid weight', 'invalid reps'])(
  'tick rejects invalid or unavailable suggestions: %s',
  async (scenario) => {
    const value = createSessionDraft(1, exampleRoutine);
    if (scenario === 'no guidance') value.exercises[0].guidance = [];
    if (scenario === 'missing reps') value.exercises[0].guidance[0].reps = null;
    if (scenario === 'invalid weight') value.exercises[0].sets[0].value = 'bad';
    if (scenario === 'invalid reps') value.exercises[0].sets[0].reps = '0';
    jest.mocked(sessionStorage.load).mockResolvedValue(value);
    mount();
    await screen.findByText('ready');
    fireEvent.press(screen.getByText('Tick'));
    await screen.findByText(
      'Enter a nonnegative weight and positive whole repetitions before saving this set.',
    );
    expect(trainingApi.saveDraft).not.toHaveBeenCalled();
    expect(draft().exercises[0].sets[0].saved).not.toBe(true);
  },
);

test('failed save retains accepted suggestions as unsaved input for retry', async () => {
  mount();
  await start();
  jest.mocked(trainingApi.saveDraft).mockRejectedValueOnce(new Error('offline'));
  fireEvent.press(screen.getByText('Tick'));
  await screen.findByText(
    'Could not save the workout. Your changes are retained. Retry the tick or Sync workout.',
  );
  expect(draft().exercises[0].sets[0]).toMatchObject({ value: '90.00', reps: '12' });
  expect(draft().exercises[0].sets[0].saved).not.toBe(true);
  fireEvent.press(screen.getByText('Tick'));
  await waitFor(() => expect(draft().exercises[0].sets[0].saved).toBe(true));
});
