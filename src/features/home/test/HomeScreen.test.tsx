import { completeAccount, incompleteAccount } from '@/features/accounts/test/fixtures';
import { getAccount, getObjective, updateProfile, setObjective } from '@/features/accounts/api';
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackHandler } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { HomeScreen } from '../components/HomeScreen';
import { nutritionApi } from '@/features/nutrition/api';
import { trainingApi } from '@/features/training/api';
import { exampleExercise } from '@/features/training/test/fixtures';

jest.mock(
  '@react-native-async-storage/async-storage',
  () => ({
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  }),
  { virtual: true },
);
jest.mock('expo-camera', () => ({
  CameraView: jest.requireActual('react-native').View,
  useCameraPermissions: () => [{ granted: false, canAskAgain: true }, jest.fn()],
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => '3e17c183-38a9-4b5c-b953-000000000001' }));
jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn(),
  VideoView: jest.requireActual('react-native').View,
}));
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
  trainingApi: {
    draft: jest.fn(),
    routines: jest.fn(),
    saveDraft: jest.fn(),
    exercise: jest.fn(),
    sessions: jest.fn(),
    session: jest.fn(),
  },
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
  expect(screen.getByText('View profile')).toBeTruthy();
  expect(screen.queryByText('Edit profile')).toBeNull();
  expect(screen.queryByText('Sign out')).toBeNull();
  expect(
    screen.getByRole('tab', { name: 'Profile' }).props.accessibilityState.disabled,
  ).toBeUndefined();
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
  render(<HomeScreen accountId={1} initialAccount={incompleteAccount} onSignOut={jest.fn()} />);
  await screen.findByText('Your profile');
  expect(screen.queryByText('Sign out')).toBeNull();
  expect(screen.queryByLabelText('Main navigation')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Name'), 'Alice');
  fireEvent.press(screen.getByText('Continue'));
  fireEvent.changeText(screen.getByLabelText('Age (years)'), '25');
  fireEvent.press(screen.getByRole('radio', { name: 'Metric' }));
  fireEvent.changeText(screen.getByLabelText('Height (cm)'), '170');
  fireEvent.changeText(screen.getByLabelText('Weight'), '70');
  fireEvent.press(screen.getByText('Continue'));
  await screen.findByText('Confirmation');
  expect(updateProfile).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Save profile'));
  await screen.findByText("What's your goal?");
  expect(screen.queryByText('Sign out')).toBeNull();
  expect(await screen.findAllByRole('radio')).toHaveLength(4);
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

test('a new authenticated response replaces cached completion for the same account', async () => {
  const onSignOut = jest.fn();
  const view = render(
    <HomeScreen accountId={1} initialAccount={completeAccount} onSignOut={onSignOut} />,
  );
  await screen.findByText('Alice');
  // Session refresh or a fresh sign-in may return the same ID with incomplete setup.
  jest.mocked(getAccount).mockResolvedValue(incompleteAccount);
  view.rerender(
    <HomeScreen accountId={1} initialAccount={incompleteAccount} onSignOut={onSignOut} />,
  );
  await screen.findByText('Your profile');
  expect(screen.queryByLabelText('Main navigation')).toBeNull();
  expect(screen.queryByText('Your plan')).toBeNull();
});

test('an older pending account read cannot overwrite a fresh incomplete sign-in response', async () => {
  let finishRead: (account: typeof completeAccount) => void = () => {};
  jest.mocked(getAccount).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishRead = resolve;
      }),
  );
  const onSignOut = jest.fn();
  const view = render(<HomeScreen accountId={1} onSignOut={onSignOut} />);
  await waitFor(() => expect(getAccount).toHaveBeenCalledTimes(1));
  view.rerender(
    <HomeScreen accountId={1} initialAccount={incompleteAccount} onSignOut={onSignOut} />,
  );
  await screen.findByText('Your profile');
  await act(async () => {
    finishRead(completeAccount);
  });
  expect(screen.getByText('Your profile')).toBeTruthy();
  expect(screen.queryByText('Your plan')).toBeNull();
});

test('completed onboarding keeps form checking available in a resumed workout', async () => {
  jest.mocked(trainingApi.exercise).mockResolvedValue({ ...exampleExercise, name: 'Back squat' });
  jest.mocked(trainingApi.draft).mockResolvedValue({
    client_session_id: '3e17c183-38a9-4b5c-b953-000000000002',
    state: 'draft',
    routine_id: null,
    name: 'Form practice',
    started_at: '2026-10-25T10:00:00Z',
    exercises: [
      {
        client_id: 'slot-1',
        exercise_id: 1,
        sets: [{ client_id: 'set-1', completed: false, reps: null, weight: null }],
      },
    ],
  });
  render(<HomeScreen accountId={1} initialAccount={completeAccount} onSignOut={jest.fn()} />);
  await screen.findByText('Alice');
  fireEvent.press(await screen.findByLabelText('Resume workout'));
  fireEvent.press(await screen.findByLabelText('Edit sets for Back squat'));
  fireEvent.press(await screen.findByText('Record set 1'));
  expect(await screen.findByText('Allow camera')).toBeTruthy();
  expect(screen.getByText('Check your form')).toBeTruthy();
});

test('Profile owns account actions and prepared progress, while Workout history opens Profile', async () => {
  jest.mocked(trainingApi.sessions).mockResolvedValue({ items: [], limit: 20, offset: 0 });
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  await screen.findByText('Alice');
  fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
  expect(screen.getByText('25 years · 170.00 cm · 70.00 kg')).toBeTruthy();
  expect(screen.getByText('Edit profile')).toBeTruthy();
  expect(screen.getByText('Sign out')).toBeTruthy();
  fireEvent.press(screen.getByText('Progress'));
  expect(screen.getByText('70.00 kg')).toBeTruthy();
  expect(screen.getByText('Measurement recording is not available yet.')).toBeTruthy();
  expect(screen.queryByText('Add measurement')).toBeNull();
  fireEvent.press(screen.getByLabelText('Back to profile'));
  fireEvent.press(screen.getByText('Training history'));
  await screen.findByText('No completed workouts yet.');
  fireEvent.press(screen.getByLabelText('Back to profile'));
  fireEvent.press(screen.getByRole('tab', { name: 'Workout' }));
  await screen.findByText('Routines');
  expect(screen.queryByText('Sign out')).toBeNull();
  fireEvent.press(screen.getByText('History'));
  expect(screen.getByRole('tab', { name: 'Profile' }).props.accessibilityState.selected).toBe(true);
  expect(screen.getByLabelText('Back to profile')).toBeTruthy();
});

test('profile form survives switching tabs and failed saves; saved account updates Home', async () => {
  const updated = {
    ...completeAccount,
    profile: { ...completeAccount.profile, display_name: 'Alice updated' },
  };
  jest
    .mocked(updateProfile)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(updated);
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByText('View profile'));
  fireEvent.press(screen.getByText('Edit profile'));
  fireEvent.changeText(screen.getByLabelText('Name'), 'Alice updated');
  fireEvent.press(screen.getByRole('tab', { name: 'Home' }));
  fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
  expect(screen.getByLabelText('Name').props.value).toBe('Alice updated');
  fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
  await screen.findByText(
    'Could not save your profile. Your details and picture choice are kept. Try again.',
  );
  expect(screen.getByLabelText('Name').props.value).toBe('Alice updated');
  fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
  await screen.findByRole('button', { name: 'Edit profile' });
  fireEvent.press(screen.getByRole('tab', { name: 'Home' }));
  expect(screen.getByText('Alice updated')).toBeTruthy();
});

test('nutrition goal closes to its origin without losing the Profile tab', async () => {
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  await screen.findByText('Alice');
  fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
  fireEvent.press(screen.getByText('Edit nutrition goal'));
  fireEvent.press(await screen.findByText('Back'));
  expect(screen.getByRole('tab', { name: 'Profile' }).props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByRole('tab', { name: 'Nutrition' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Edit nutrition goal' }));
  fireEvent.press(await screen.findByText('Back'));
  expect(screen.getByRole('tab', { name: 'Nutrition' }).props.accessibilityState.selected).toBe(
    true,
  );
});

test('Profile sign-out waits for local cleanup, prevents duplicates and allows retry after failure', async () => {
  const onSignOut = jest.fn();
  let rejectClear: (error: Error) => void = () => {};
  jest.mocked(AsyncStorage.removeItem).mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectClear = reject;
      }),
  );
  render(<HomeScreen accountId={1} onSignOut={onSignOut} />);
  await screen.findByText('Alice');
  fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
  fireEvent.press(screen.getByText('Sign out'));
  await screen.findByText('Signing out…');
  fireEvent.press(screen.getByText('Signing out…'));
  await waitFor(() => expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1));
  expect(onSignOut).not.toHaveBeenCalled();
  await act(async () => rejectClear(new Error('storage unavailable')));
  await screen.findByText('Could not sign out. Please try again.');
  fireEvent.press(screen.getByText('Sign out'));
  await waitFor(() => expect(onSignOut).toHaveBeenCalledTimes(1));
  expect(AsyncStorage.removeItem).toHaveBeenLastCalledWith('kinetix.workout.v1.account.1');
});

test('account switch discards private Profile fields and panel state', async () => {
  const view = render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByText('View profile'));
  fireEvent.press(screen.getByText('Edit profile'));
  fireEvent.changeText(screen.getByLabelText('Name'), 'Private unsaved name');
  const bob = {
    ...completeAccount,
    id: 2,
    profile: { ...completeAccount.profile, display_name: 'Bob' },
  };
  jest.mocked(getAccount).mockResolvedValue(bob);
  view.rerender(<HomeScreen accountId={2} initialAccount={bob} onSignOut={jest.fn()} />);
  await screen.findByText('Bob');
  fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
  expect(screen.queryByText('Private unsaved name')).toBeNull();
  expect(screen.queryByLabelText('Name')).toBeNull();
  expect(screen.getByText('Edit profile')).toBeTruthy();
});

test('hardware back closes editing and ignores hidden Profile panels', async () => {
  const callbacks = new Set<Parameters<typeof BackHandler.addEventListener>[1]>();
  const listener = jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, callback) => {
      callbacks.add(callback);
      return {
        remove: () => {
          callbacks.delete(callback);
        },
      };
    });
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByText('View profile'));
  fireEvent.press(screen.getByText('Edit profile'));
  fireEvent.changeText(screen.getByLabelText('Name'), 'Draft name');
  fireEvent.press(screen.getByRole('tab', { name: 'Home' }));
  expect(callbacks.size).toBe(0);
  fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
  await act(async () => {
    [...callbacks].at(-1)?.({ type: 'hardwareBackPress', timeStamp: 0 });
  });
  expect(screen.getByText('Edit profile')).toBeTruthy();
  listener.mockRestore();
});
