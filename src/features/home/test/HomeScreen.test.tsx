import { completeAccount, incompleteAccount } from '@/features/accounts/test/fixtures';
import { getAccount, getObjective, updateProfile, setObjective } from '@/features/accounts/api';
import { progressApi } from '@/features/accounts/progressApi';
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackHandler } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { HomeScreen } from '../components/HomeScreen';
import { nutritionApi } from '@/features/nutrition/api';
import { trainingApi } from '@/features/training/api';
import { feedApi } from '@/features/feed/api';
import { friendsApi } from '@/features/friends/api';
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
jest.mock('@/features/accounts/progressApi', () => ({
  ...jest.requireActual('@/features/accounts/progressApi'),
  progressApi: { measurements: jest.fn(), target: jest.fn() },
}));
jest.mock('@/features/nutrition/api', () => ({
  nutritionApi: {
    goal: jest.fn(),
    createGoal: jest.fn(),
    updateGoal: jest.fn(),
    day: jest.fn(),
    foodPage: jest.fn(),
  },
}));
jest.mock('@/features/friends/api', () => ({
  ...jest.requireActual('@/features/friends/api'),
  friendsApi: { requests: jest.fn(), friends: jest.fn() },
}));
jest.mock('@/features/feed/api', () => ({
  feedApi: { posts: jest.fn(), comments: jest.fn(), media: jest.fn(), workoutOptions: jest.fn() },
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
// The first render loads every feature module; allow cold starts on slower machines.
jest.setTimeout(20000);

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
  jest.mocked(nutritionApi.foodPage).mockResolvedValue([]);
  jest.mocked(trainingApi.draft).mockResolvedValue(null);
  jest.mocked(trainingApi.saveDraft).mockImplementation(async (id, snapshot) => ({
    ...snapshot,
    client_session_id: id,
    state: 'draft',
  }));
  jest.mocked(trainingApi.routines).mockResolvedValue({ items: [], limit: 20, offset: 0 });
  jest.mocked(feedApi.posts).mockResolvedValue({ items: [], next_before_id: null });
  jest.mocked(feedApi.workoutOptions).mockResolvedValue({ items: [], selected: null });
  jest.mocked(friendsApi.requests).mockResolvedValue({ incoming: [], outgoing: [] });
  jest.mocked(friendsApi.friends).mockResolvedValue({ items: [], limit: 50, offset: 0 });
});

test('a pending friend request badges the avatar and Profile opens Friends on Requests', async () => {
  jest.mocked(friendsApi.requests).mockResolvedValue({
    incoming: [
      {
        user: { id: 3, display_name: 'Carol', has_picture: false },
        created_at: '2026-11-15T10:00:00Z',
      },
    ],
    outgoing: [],
  });
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  await screen.findByText('No posts yet', undefined, { timeout: 10000 });
  expect(await screen.findByTestId('friend-request-badge')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Open profile' }).props.accessibilityHint).toBe(
    '1 new friend request',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Open profile' }));
  fireEvent.press(await screen.findByText('Friends'));
  expect(await screen.findByText('Wants to be your friend')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Back to profile' }));
  expect(await screen.findByText('1 new request')).toBeTruthy();
});

test('home shows the feed with profile access while keeping one bottom bar', async () => {
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  // First render loads every feature module; allow a cold start on slower machines.
  await screen.findByText('No posts yet', undefined, { timeout: 10000 });
  expect(feedApi.posts).toHaveBeenCalledWith(null, expect.any(AbortSignal), 'friends');
  expect(screen.getByRole('tab', { name: 'Feed' }).props.accessibilityState.selected).toBe(true);
  expect(trainingApi.routines).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'New post' })).toBeTruthy();
  expect(screen.queryByText('Edit profile')).toBeNull();
  expect(screen.queryByText('Sign out')).toBeNull();
  expect(screen.queryByRole('tab', { name: 'Profile' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Open profile' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'League' }).props.accessibilityState.disabled).not.toBe(
    true,
  );
  // Plan shortcuts now live only in Profile.
  expect(screen.queryByText('Change objective')).toBeNull();
  expect(screen.getAllByLabelText('Main navigation')).toHaveLength(1);
  fireEvent.press(screen.getByRole('tab', { name: 'Nutrition' }));
  await screen.findByLabelText('Add food to Breakfast');
  fireEvent.press(screen.getByLabelText('Add food to Breakfast'));
  expect(screen.queryByLabelText('Main navigation')).toBeNull();
});

test('home header profile picture opens Profile and its back arrow returns Home', async () => {
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByRole('button', { name: 'Open profile' }));
  expect(await screen.findByText('Edit profile')).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Feed' }).props.accessibilityState.selected).toBe(false);
  fireEvent.press(screen.getByRole('button', { name: 'Back to feed' }));
  expect(screen.getByRole('tab', { name: 'Feed' }).props.accessibilityState.selected).toBe(true);
  expect(screen.queryByText('Edit profile')).toBeNull();
});

test('a Spanish profile shows translated plan and plural friend request details', async () => {
  jest.mocked(getAccount).mockResolvedValue({
    ...completeAccount,
    profile: { ...completeAccount.profile, language: 'es', measurement_system: 'imperial' },
  });
  jest.mocked(friendsApi.requests).mockResolvedValue({
    incoming: [3, 4].map((id) => ({
      user: { id, display_name: `Friend ${id}`, has_picture: false },
      created_at: '2026-11-15T10:00:00Z',
    })),
    outgoing: [],
  });
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  const profileButton = await screen.findByRole('button', { name: 'Abrir perfil' });
  await waitFor(() =>
    expect(profileButton.props.accessibilityHint).toBe('2 nuevas solicitudes de amistad'),
  );
  fireEvent.press(profileButton);
  expect(await screen.findByText('Ganar músculo')).toBeTruthy();
  expect(screen.getByText('Imperial · lb, pies y pulgadas')).toBeTruthy();
  expect(screen.getByText('2 nuevas solicitudes')).toBeTruthy();
});

test('plus starts the existing workout editor and a minimized draft survives navigation without duplicate starts', async () => {
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  await waitFor(() =>
    expect(screen.getByLabelText('Start workout').props.accessibilityState.disabled).toBe(false),
  );
  fireEvent.press(screen.getByLabelText('Start workout'));
  await waitFor(() =>
    expect(screen.getByTestId('workout-pull-handle').props.accessibilityState.disabled).toBe(false),
  );
  fireEvent(screen.getByTestId('workout-pull-handle'), 'responderGrant', {
    nativeEvent: { pageY: 10 },
  });
  fireEvent(screen.getByTestId('workout-pull-handle'), 'responderRelease', {
    nativeEvent: { pageY: 100 },
  });
  expect(screen.getByLabelText('Start workout').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByRole('tab', { name: 'Nutrition' }));
  await screen.findByLabelText('Add food to Breakfast');
  expect(screen.getByLabelText('Resume workout')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'Workout' }));
  await screen.findByText('Workouts');
  expect(
    screen.getByRole('button', { name: 'Start workout' }).props.accessibilityState.disabled,
  ).toBe(true);
  fireEvent.press(screen.getByLabelText('Resume workout'));
  expect(screen.getByTestId('workout-pull-handle')).toBeTruthy();
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
  fireEvent.press(screen.getByRole('radio', { name: 'Female' }));
  fireEvent.press(screen.getByText('Continue'));
  fireEvent.press(screen.getByRole('radio', { name: /^Moderate\./ }));
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
  await screen.findByText('No posts yet');
  fireEvent.press(screen.getByRole('tab', { name: 'Workout' }));
  await waitFor(() => expect(trainingApi.routines).toHaveBeenCalledTimes(1));
  const signal = jest.mocked(trainingApi.routines).mock.calls[0][1];
  jest.mocked(getAccount).mockResolvedValue({ ...completeAccount, id: 2 });
  await act(async () => view.rerender(<HomeScreen accountId={2} onSignOut={jest.fn()} />));
  await screen.findByText('No posts yet');
  expect(signal?.aborted).toBe(true);
  expect(screen.getByRole('tab', { name: 'Feed' }).props.accessibilityState.selected).toBe(true);
  expect(screen.queryByText('Workouts')).toBeNull();
});

test('a new authenticated response replaces cached completion for the same account', async () => {
  const onSignOut = jest.fn();
  const view = render(
    <HomeScreen accountId={1} initialAccount={completeAccount} onSignOut={onSignOut} />,
  );
  await screen.findByText('No posts yet');
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
  await screen.findByText('No posts yet');
  fireEvent.press(await screen.findByLabelText('Resume workout'));
  fireEvent.press(await screen.findByLabelText('Edit sets for Back squat'));
  fireEvent.press(await screen.findByText('Record set 1'));
  expect(await screen.findByText('Allow camera')).toBeTruthy();
  expect(screen.getByText('Check your form')).toBeTruthy();
});

test('Profile owns account actions, progress and history; Workout omits duplicate history navigation', async () => {
  jest.mocked(trainingApi.sessions).mockResolvedValue({ items: [], limit: 20, offset: 0 });
  jest.mocked(progressApi.measurements).mockResolvedValue({ items: [] });
  jest.mocked(progressApi.target).mockResolvedValue({ objective: 'gain_weight', target: null });
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  await screen.findByText('No posts yet');
  fireEvent.press(screen.getByRole('button', { name: 'Open profile' }));
  expect(screen.getByText('25 years · 170.00 cm · 70.00 kg')).toBeTruthy();
  expect(screen.getByText('Edit profile')).toBeTruthy();
  expect(screen.getByText('Sign out')).toBeTruthy();
  fireEvent.press(screen.getByText('Progress'));
  expect(await screen.findByText('No weight measurements yet.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Log measurements' })).toBeTruthy();
  expect(screen.getByTestId('body-measurement-chart')).toBeTruthy();
  expect(screen.queryByLabelText('Main navigation')).toBeNull();
  fireEvent.press(screen.getByLabelText('Back to profile'));
  expect(screen.getByLabelText('Main navigation')).toBeTruthy();
  fireEvent.press(screen.getByText('Training history'));
  await screen.findByText('No completed workouts yet.');
  fireEvent.press(screen.getByLabelText('Back to profile'));
  fireEvent.press(screen.getByRole('tab', { name: 'Workout' }));
  await screen.findByText('Workouts');
  expect(screen.queryByText('Sign out')).toBeNull();
  expect(screen.queryByText('History')).toBeNull();
  expect(screen.queryByRole('tab', { name: 'Profile' })).toBeNull();
  fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
  fireEvent.press(screen.getByRole('button', { name: 'Open profile' }));
  fireEvent.press(screen.getByText('Training history'));
  expect(await screen.findByText('No completed workouts yet.')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Back to profile'));
  fireEvent.press(screen.getByRole('button', { name: 'Back to feed' }));
  expect(screen.getByRole('tab', { name: 'Feed' }).props.accessibilityState.selected).toBe(true);
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
  fireEvent.press(await screen.findByRole('button', { name: 'Open profile' }));
  fireEvent.press(screen.getByText('Edit profile'));
  fireEvent.changeText(screen.getByLabelText('Name'), 'Alice updated');
  fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
  fireEvent.press(screen.getByRole('button', { name: 'Open profile' }));
  expect(screen.getByLabelText('Name').props.value).toBe('Alice updated');
  fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
  await screen.findByText(
    'Could not save your profile. Your details and picture choice are kept. Try again.',
  );
  expect(screen.getByLabelText('Name').props.value).toBe('Alice updated');
  fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
  await screen.findByRole('button', { name: 'Edit profile' });
  expect(screen.getByText('Alice updated')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
  fireEvent.press(screen.getByRole('button', { name: 'Open profile' }));
  expect(screen.getByText('Alice updated')).toBeTruthy();
});

test('nutrition goal closes to its origin without losing Profile', async () => {
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  await screen.findByText('No posts yet');
  fireEvent.press(screen.getByRole('button', { name: 'Open profile' }));
  fireEvent.press(screen.getByText('Edit nutrition goal'));
  fireEvent.press(await screen.findByRole('button', { name: 'Back' }));
  expect(screen.getByRole('button', { name: 'Back to feed' })).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'Nutrition' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Edit nutrition goal' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Back' }));
  expect(screen.getByRole('tab', { name: 'Nutrition' }).props.accessibilityState.selected).toBe(
    true,
  );
});

test('Feed avatar resets the Profile return origin after a Nutrition shortcut', async () => {
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  await screen.findByText('No posts yet');
  fireEvent.press(screen.getByRole('tab', { name: 'Nutrition' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Edit nutrition goal' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Back' }));
  expect(screen.getByRole('tab', { name: 'Nutrition' }).props.accessibilityState.selected).toBe(
    true,
  );
  // Profile remains mounted after the shortcut closes; Home's avatar resumes it.
  fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
  fireEvent.press(screen.getByRole('button', { name: 'Open profile' }));
  expect(screen.getByRole('button', { name: 'Back to feed' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Back to nutrition' })).toBeNull();
  expect(screen.queryByRole('tab', { name: 'Profile' })).toBeNull();
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
  await screen.findByText('No posts yet');
  fireEvent.press(screen.getByRole('button', { name: 'Open profile' }));
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
  fireEvent.press(await screen.findByRole('button', { name: 'Open profile' }));
  fireEvent.press(screen.getByText('Edit profile'));
  fireEvent.changeText(screen.getByLabelText('Name'), 'Private unsaved name');
  const bob = {
    ...completeAccount,
    id: 2,
    profile: { ...completeAccount.profile, display_name: 'Bob' },
  };
  jest.mocked(getAccount).mockResolvedValue(bob);
  view.rerender(<HomeScreen accountId={2} initialAccount={bob} onSignOut={jest.fn()} />);
  await screen.findByText('No posts yet');
  fireEvent.press(screen.getByRole('button', { name: 'Open profile' }));
  expect(screen.getByText('Bob')).toBeTruthy();
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
  fireEvent.press(await screen.findByRole('button', { name: 'Open profile' }));
  fireEvent.press(screen.getByText('Edit profile'));
  fireEvent.changeText(screen.getByLabelText('Name'), 'Draft name');
  fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
  expect(callbacks.size).toBe(0);
  fireEvent.press(screen.getByRole('button', { name: 'Open profile' }));
  await act(async () => {
    [...callbacks].at(-1)?.({ type: 'hardwareBackPress', timeStamp: 0 });
  });
  expect(screen.getByText('Edit profile')).toBeTruthy();
  await act(async () => {
    [...callbacks].at(-1)?.({ type: 'hardwareBackPress', timeStamp: 0 });
  });
  expect(screen.getByRole('tab', { name: 'Feed' }).props.accessibilityState.selected).toBe(true);
  listener.mockRestore();
});

test('the Feed composer hides and restores bottom navigation', async () => {
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByRole('button', { name: 'New post' }));
  expect(screen.queryByRole('tab', { name: 'Feed' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Back to feed' }));
  expect(await screen.findByRole('tab', { name: 'Feed', selected: true })).toBeTruthy();
});

test('changing profile language updates mounted navigation and screens immediately', async () => {
  const spanishAccount = {
    ...completeAccount,
    profile: { ...completeAccount.profile, language: 'es' as const },
  };
  jest.mocked(updateProfile).mockResolvedValueOnce(spanishAccount);
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  await screen.findByText('No posts yet', undefined, { timeout: 10000 });
  fireEvent.press(screen.getByRole('button', { name: 'Open profile' }));
  fireEvent.press(screen.getByText('Edit profile'));
  fireEvent.press(screen.getByRole('radio', { name: 'Español' }));
  expect(screen.getByText('Editar perfil')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Guardar perfil' }));
  await screen.findByRole('button', { name: 'Editar perfil' });
  expect(screen.getByRole('tab', { name: 'Inicio' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Entreno' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Nutrición' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Liga' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Volver a inicio' }));
  expect(await screen.findByRole('header', { name: 'Inicio' })).toBeTruthy();
  expect(screen.getByText('Aún no hay publicaciones')).toBeTruthy();
});

test('a workout from Training history can be shared and opens the Feed composer', async () => {
  const finished = {
    id: 5,
    client_session_id: null,
    routine_id: null,
    activity_type: 'gym',
    state: 'completed' as const,
    title: 'Training session',
    started_at: '2026-11-17T10:00:00Z',
    ended_at: '2026-11-17T11:00:00Z',
    exercises: [],
  };
  jest.mocked(trainingApi.sessions).mockResolvedValue({ items: [finished], limit: 50, offset: 0 });
  jest.mocked(trainingApi.session).mockResolvedValue(finished);
  jest.mocked(feedApi.workoutOptions).mockResolvedValue({
    items: [],
    selected: {
      session_id: finished.id,
      title: finished.title,
      started_at: finished.started_at,
      ended_at: finished.ended_at,
      activity_type: finished.activity_type,
      duration_seconds: 3600,
      exercise_count: 0,
      set_count: 0,
      total_reps: 0,
      total_volume_kg: '0',
      exercises: [],
    },
  });
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  await screen.findByText('No posts yet', undefined, { timeout: 10000 });
  fireEvent.press(screen.getByRole('button', { name: 'Open profile' }));
  fireEvent.press(screen.getByText('Training history'));
  fireEvent.press(await screen.findByTestId('history-workout-5'));
  fireEvent.press(await screen.findByRole('button', { name: 'Share to feed' }));
  expect(screen.queryByRole('tab', { name: 'Feed' })).toBeNull();
  expect(
    await screen.findByRole('button', { name: 'Workout to share: Training session' }),
  ).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Back to feed' }));
  expect(await screen.findByRole('tab', { name: 'Feed', selected: true })).toBeTruthy();
});

test('changing profile language updates mounted navigation and screens immediately', async () => {
  const spanishAccount = {
    ...completeAccount,
    profile: { ...completeAccount.profile, language: 'es' as const },
  };
  jest.mocked(updateProfile).mockResolvedValueOnce(spanishAccount);
  render(<HomeScreen accountId={1} onSignOut={jest.fn()} />);
  await screen.findByText('No posts yet', undefined, { timeout: 10000 });
  fireEvent.press(screen.getByRole('button', { name: 'Open profile' }));
  fireEvent.press(screen.getByText('Edit profile'));
  fireEvent.press(screen.getByRole('radio', { name: 'Español' }));
  expect(screen.getByText('Editar perfil')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Guardar perfil' }));
  await screen.findByRole('button', { name: 'Editar perfil' });
  expect(screen.getByRole('tab', { name: 'Inicio' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Entreno' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Nutrición' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Liga' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Volver a inicio' }));
  expect(await screen.findByRole('header', { name: 'Inicio' })).toBeTruthy();
  expect(screen.getByText('Aún no hay publicaciones')).toBeTruthy();
});
