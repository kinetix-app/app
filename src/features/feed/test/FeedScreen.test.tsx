import React from 'react';
import { LanguageProvider } from '@/i18n/Language';
import { AccessibilityInfo, BackHandler, FlatList, Image, Modal, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import { textStyles } from '@/theme/tokens';
import { ApiError } from '@/services/apiClient';
import { trainingApi } from '@/features/training/api';
import { exampleExercise } from '@/features/training/test/fixtures';
import { friendsApi } from '@/features/friends/api';
import { feedApi } from '../api';
import * as ImagePicker from 'expo-image-picker';
import { FeedScreen } from '../components/FeedScreen';
import { makePost } from './fixtures';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('@/features/training/api', () => ({
  trainingApi: { sessions: jest.fn(), session: jest.fn() },
}));
jest.mock('@/features/friends/api', () => ({
  ...jest.requireActual('@/features/friends/api'),
  friendsApi: {
    person: jest.fn(),
    picture: jest.fn(),
    request: jest.fn(),
    accept: jest.fn(),
    remove: jest.fn(),
  },
}));
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  feedApi: {
    posts: jest.fn(),
    post: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    like: jest.fn(),
    comments: jest.fn(),
    addComment: jest.fn(),
    removeComment: jest.fn(),
    media: jest.fn(),
    workout: jest.fn(),
    workoutTemplate: jest.fn(),
    workoutOptions: jest.fn(),
  },
}));

// Composer flows have many interactions; allow for slower machines.
jest.setTimeout(20000);

const workout = makePost().workout!;
async function selectWorkout() {
  fireEvent.press(screen.getByRole('button', { name: 'Workout to share: No workout' }));
  const option = await screen.findByRole('button', { name: workout.title });
  expect(option.props.accessibilityState.selected).toBe(false);
  fireEvent.press(option);
}

const clients: QueryClient[] = [];

function renderFeed(props: Partial<React.ComponentProps<typeof FeedScreen>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <FeedScreen accountId={1} {...props} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  jest.spyOn(View.prototype, 'measureInWindow').mockImplementation((measure) => {
    if (typeof measure === 'function') measure(16, 160, 358, 64);
  });
  jest.clearAllMocks();
  jest.mocked(feedApi.posts).mockResolvedValue({ items: [makePost()], next_before_id: null });
  jest.mocked(feedApi.post).mockResolvedValue(makePost());
  jest.mocked(feedApi.comments).mockResolvedValue({ items: [], next_after_id: null });
  jest.mocked(feedApi.workoutOptions).mockImplementation(async (selected) => ({
    items: [workout],
    selected: selected === workout.session_id ? workout : null,
  }));
});

test('feed shows the author, description, workout title, summary and counts', async () => {
  renderFeed();
  expect(await screen.findByText('Bob')).toBeTruthy();
  expect(screen.getByText('Leg day done')).toBeTruthy();
  expect(screen.getByText('Strength A')).toBeTruthy();
  expect(screen.getByText('2 h ago')).toBeTruthy();
  expect(screen.getByText('45 min')).toBeTruthy();
  expect(screen.getByText('1,312.5 kg')).toBeTruthy();
  expect(screen.getByText('Exercises')).toBeTruthy();
  expect(screen.queryByText('Bench press · Squat')).toBeNull();
  expect(screen.getByText('2 likes')).toBeTruthy();
  expect(feedApi.posts).toHaveBeenCalledWith(null, expect.any(AbortSignal), 'friends');
});

test('captions are headings while descriptions keep body typography', async () => {
  jest.mocked(feedApi.posts).mockResolvedValue({
    items: [
      makePost({ caption: 'A bigger caption', description: '' }),
      makePost({ id: 11, caption: '', description: 'Description only' }),
    ],
    next_before_id: null,
  });
  renderFeed();
  expect(await screen.findByRole('header', { name: 'A bigger caption' })).toHaveStyle(
    textStyles['title-lg'],
  );
  expect(screen.getByText('Description only')).toHaveStyle(textStyles.body);
  expect(screen.queryByRole('header', { name: 'Description only' })).toBeNull();
});

test('a workout without lifting volume shows its exercise count and recorded duration', async () => {
  const post = makePost();
  jest.mocked(feedApi.posts).mockResolvedValue({
    items: [
      makePost({ workout: { ...post.workout!, duration_seconds: 26, total_volume_kg: '0.00' } }),
    ],
    next_before_id: null,
  });
  renderFeed();
  const summary = within(await screen.findByRole('button', { name: 'See Bob’s workout' }));
  expect(summary.getByText('26 sec')).toBeTruthy();
  expect(summary.getByText('Exercises')).toBeTruthy();
  expect(summary.getByText('0 kg')).toBeTruthy();
  expect(feedApi.workout).not.toHaveBeenCalled();
});

test('empty feed invites the person to share a workout', async () => {
  jest.mocked(feedApi.posts).mockResolvedValue({ items: [], next_before_id: null });
  renderFeed();
  expect(await screen.findByText('No posts yet')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Create a post' }));
  expect(await screen.findByText('New post', { exact: true })).toBeTruthy();
});

test('like waits for the server, blocks duplicates and shows confirmed counts', async () => {
  let respond: (value: { liked: boolean; like_count: number }) => void = () => {};
  jest.mocked(feedApi.like).mockImplementation(
    () =>
      new Promise((resolve) => {
        respond = resolve;
      }),
  );
  renderFeed();
  const like = await screen.findByRole('button', { name: 'Like post by Bob' });
  fireEvent.press(like);
  fireEvent.press(like);
  expect(feedApi.like).toHaveBeenCalledTimes(1);
  expect(feedApi.like).toHaveBeenCalledWith(10, true);
  expect(screen.getByText('2 likes')).toBeTruthy();
  await act(async () => respond({ liked: true, like_count: 3 }));
  expect(await screen.findByText('3 likes')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Unlike post by Bob' })).toBeTruthy();

  jest.mocked(feedApi.like).mockRejectedValueOnce(new Error('offline'));
  fireEvent.press(screen.getByRole('button', { name: 'Unlike post by Bob' }));
  expect(await screen.findByText('Could not update your like. Try again.')).toBeTruthy();
  expect(screen.getByText('3 likes')).toBeTruthy();
});

test('reaching the end loads older posts and keeps them after a failed page', async () => {
  jest
    .mocked(feedApi.posts)
    .mockResolvedValueOnce({ items: [makePost()], next_before_id: 10 })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({
      items: [makePost({ id: 9, description: 'Older session' })],
      next_before_id: null,
    });
  renderFeed();
  await screen.findByText('Leg day done');
  const list = screen.UNSAFE_getByType(FlatList);
  await act(async () => list.props.onEndReached());
  expect(await screen.findByText('Could not load more posts. Your feed is kept.')).toBeTruthy();
  expect(screen.getByText('Leg day done')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Older session')).toBeTruthy();
  expect(feedApi.posts).toHaveBeenLastCalledWith(10, expect.any(AbortSignal), 'friends');
});

test('a forbidden feed request gives account recovery guidance in Spanish', async () => {
  jest.mocked(feedApi.posts).mockRejectedValueOnce(new ApiError(403));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <LanguageProvider language="es">
        <FeedScreen accountId={1} />
      </LanguageProvider>
    </QueryClientProvider>,
  );

  expect(
    await screen.findByText(
      'Tu cuenta no puede cargar el feed. Cierra sesión y vuelve a iniciarla.',
    ),
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
});

test('comments open, post a trimmed comment and update the feed count', async () => {
  jest.mocked(feedApi.addComment).mockResolvedValue({
    id: 1,
    post_id: 10,
    author: { id: 1, display_name: 'Alice', has_picture: false },
    comment: 'Strong work',
    created_at: new Date().toISOString(),
    is_mine: true,
  });
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: /Comments on post by Bob/ }));
  expect(await screen.findByText('No comments yet. Start the conversation.')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Write a comment'), '  Strong work  ');
  fireEvent.press(screen.getByRole('button', { name: 'Send comment' }));
  expect(await screen.findByText('Strong work')).toBeTruthy();
  expect(feedApi.addComment).toHaveBeenCalledWith(10, 'Strong work');
  expect(screen.getByLabelText('Write a comment').props.value).toBe('');
  fireEvent.press(screen.getByRole('button', { name: 'Back to feed' }));
  expect(await screen.findByText('1 comment')).toBeTruthy();
});

test('comments show the current post content without feed actions', async () => {
  jest.mocked(feedApi.post).mockResolvedValue(makePost({ caption: 'Current caption' }));
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: /Comments on post by Bob/ }));
  const summary = within(await screen.findByTestId('post-10'));
  expect(summary.getByText('Bob')).toBeTruthy();
  expect(summary.getByRole('header', { name: 'Current caption' })).toBeTruthy();
  expect(summary.getByText('Leg day done')).toBeTruthy();
  expect(summary.getByText('Strength A')).toBeTruthy();
  expect(summary.queryByRole('button', { name: 'Post options' })).toBeNull();
  expect(screen.getByLabelText('Write a comment')).toBeTruthy();
  expect(feedApi.post).toHaveBeenCalledWith(10, expect.any(AbortSignal));
});

test('a post that has become unavailable is removed from the feed before commenting', async () => {
  jest.mocked(feedApi.post).mockRejectedValueOnce(new ApiError(404));
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: /Comments on post by Bob/ }));
  expect(await screen.findByText('This post is no longer available.')).toBeTruthy();
  expect(screen.queryByLabelText('Write a comment')).toBeNull();
  expect(feedApi.comments).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Back to feed' }));
  expect(await screen.findByText('No posts yet')).toBeTruthy();
});

test('losing access while commenting removes the composer and post context', async () => {
  jest.mocked(feedApi.addComment).mockRejectedValueOnce(new ApiError(404));
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: /Comments on post by Bob/ }));
  await screen.findByText('No comments yet. Start the conversation.');
  fireEvent.changeText(screen.getByLabelText('Write a comment'), 'My message');
  fireEvent.press(screen.getByRole('button', { name: 'Send comment' }));
  expect(await screen.findByText('This post is no longer available.')).toBeTruthy();
  expect(screen.queryByLabelText('Write a comment')).toBeNull();
  expect(screen.queryByTestId('post-10')).toBeNull();
});

test('tapping a shared workout shows every exercise and set', async () => {
  const summary = makePost().workout!;
  jest.mocked(feedApi.workout).mockResolvedValue({
    ...summary,
    detailed_exercises: [
      {
        exercise_id: 3,
        name: 'Bench press',
        image_url: 'https://media.example/bench.jpg',
        sets: [
          {
            set_number: 1,
            reps: 8,
            weight_kg: '100.00',
            duration_seconds: null,
            distance_km: null,
          },
          { set_number: 2, reps: 5, weight_kg: '62.50', duration_seconds: null, distance_km: null },
        ],
      },
      {
        exercise_id: 4,
        name: 'Plank',
        sets: [
          { set_number: 1, reps: null, weight_kg: null, duration_seconds: 45, distance_km: null },
        ],
      },
    ],
  });
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: 'See Bob’s workout' }));
  const bench = await screen.findByTestId('workout-exercise-0');
  expect(screen.getByRole('header', { name: 'Workout detail' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Exercise results' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Strength A' })).toBeTruthy();
  expect(within(screen.getByTestId('workout-detail-author')).getByText('Bob')).toBeTruthy();
  expect(within(bench).getByText('1. Bench press')).toBeTruthy();
  expect(within(bench).queryByText('2 sets', { exact: true })).toBeNull();
  const image = within(bench).getByLabelText('Image of Bench press');
  expect(image.props.source).toEqual({ uri: 'https://media.example/bench.jpg' });
  fireEvent(image, 'error');
  expect(within(bench).queryByLabelText('Image of Bench press')).toBeNull();
  expect(within(bench).getByRole('columnheader', { name: 'Weight (kg)' })).toBeTruthy();
  expect(
    within(bench)
      .getAllByRole('cell')
      .map((cell) => cell.props.children),
  ).toEqual([1, '100.00', 8, 2, '62.50', 5]);
  const plank = within(screen.getByTestId('workout-exercise-1'));
  expect(plank.getByRole('columnheader', { name: 'Distance (km)' })).toBeTruthy();
  expect(plank.getAllByRole('cell').map((cell) => cell.props.children)).toEqual([
    1,
    '—',
    '00:00:45',
  ]);
  const primary = within(screen.getByTestId('workout-detail-primary-metrics'));
  expect(primary.getByText('1,312.5 kg')).toBeTruthy();
  expect(primary.getByText('Exercises')).toBeTruthy();
  const secondary = within(screen.getByTestId('workout-detail-secondary-metrics'));
  expect(secondary.getByText('Sets')).toBeTruthy();
  expect(secondary.getByText('23')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Share to feed' })).toBeNull();
  expect(feedApi.workout).toHaveBeenCalledWith(10, expect.any(AbortSignal));
  fireEvent.press(screen.getByRole('button', { name: 'Back to feed' }));
  expect(await screen.findByText('Leg day done')).toBeTruthy();
});

test('a workout that is no longer available says so', async () => {
  jest.mocked(feedApi.workout).mockRejectedValue(new ApiError(404));
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: 'See Bob’s workout' }));
  expect(await screen.findByText('This workout is no longer available.')).toBeTruthy();
});

test('the send icon is disabled for blank text and while submitting', async () => {
  let reject = (_: Error) => {};
  jest.mocked(feedApi.addComment).mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: /Comments on post by Bob/ }));
  const send = await screen.findByRole('button', { name: 'Send comment' });
  expect(send).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Write a comment'), 'A comment');
  fireEvent.press(send);
  expect(send).toBeDisabled();
  expect(send.props.accessibilityState.busy).toBe(true);
  await act(async () => reject(new Error('offline')));
  expect(send).not.toBeDisabled();
  expect(send.props.accessibilityState.busy).toBe(false);
  expect(screen.getByLabelText('Write a comment').props.value).toBe('A comment');
});

test('failed comment keeps the text', async () => {
  jest.mocked(feedApi.addComment).mockRejectedValue(new Error('offline'));
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: /Comments on post by Bob/ }));
  fireEvent.changeText(await screen.findByLabelText('Write a comment'), 'Nice');
  fireEvent.press(screen.getByRole('button', { name: 'Send comment' }));
  expect(
    await screen.findByText('Could not post your comment. Your text is kept. Try again.'),
  ).toBeTruthy();
  expect(screen.getByLabelText('Write a comment').props.value).toBe('Nice');
});

test('sharing a workout posts it and shows it first in the feed', async () => {
  const shared = makePost({
    id: 11,
    caption: 'New PR',
    description: 'Two extra reps on the final set.',
    is_mine: true,
    author: { id: 1, display_name: 'Alice', has_picture: false },
  });
  jest.mocked(feedApi.create).mockResolvedValue(shared);
  jest.mocked(trainingApi.session).mockResolvedValue({
    id: 7,
    client_session_id: null,
    routine_id: 4,
    title: workout.title,
    started_at: '2026-11-09T16:00:00Z',
    ended_at: workout.ended_at,
    activity_type: 'gym',
    state: 'completed',
    exercises: [{ id: 1, exercise_order: 1, exercise: exampleExercise, sets: [] }],
  });
  renderFeed();
  await screen.findByText('Leg day done');
  fireEvent.press(screen.getByRole('button', { name: 'New post' }));
  expect(screen.queryByRole('button', { name: 'Preview workout' })).toBeNull();
  const picker = screen.getByRole('button', { name: 'Workout to share: No workout' });
  fireEvent.press(picker);
  const menu = await screen.findByTestId('post-workout-menu');
  expect(within(menu).queryByRole('button', { name: 'Preview No workout' })).toBeNull();
  fireEvent.press(await within(menu).findByRole('button', { name: `Preview ${workout.title}` }));
  const pickerModal = screen
    .UNSAFE_getAllByType(Modal)
    .find((item) => item.props.statusBarTranslucent);
  act(() => pickerModal?.props.onDismiss?.());
  expect(await screen.findByRole('header', { name: workout.title })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Back to new post' }));
  expect(screen.getByRole('button', { name: 'Workout to share: No workout' })).toBeTruthy();
  await selectWorkout();
  expect(screen.getByLabelText('Caption').props.value).toBe('');
  fireEvent.changeText(screen.getByLabelText('Caption'), 'New PR');
  fireEvent.changeText(screen.getByLabelText('Description'), 'Two extra reps on the final set.');
  fireEvent.press(screen.getByRole('button', { name: 'Preview workout' }));
  expect(await screen.findByText('1. Bench press')).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Workout detail' })).toBeTruthy();
  expect(screen.getByRole('header', { name: workout.title })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Share to feed' })).toBeNull();
  expect(trainingApi.session).toHaveBeenCalledWith(7, 'kg', expect.any(AbortSignal));
  fireEvent.press(screen.getByRole('button', { name: 'Back to new post' }));
  expect(screen.getByLabelText('Caption').props.value).toBe('New PR');
  expect(screen.getByLabelText('Description').props.value).toBe('Two extra reps on the final set.');
  expect(screen.getByRole('button', { name: 'Workout to share: Strength A' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Share' }));
  await waitFor(() =>
    expect(feedApi.create).toHaveBeenCalledWith({
      trainingSessionId: 7,
      caption: 'New PR',
      description: 'Two extra reps on the final set.',
      visibility: 'FRIENDS',
      photos: [],
    }),
  );
  expect(await screen.findByText('New PR')).toBeTruthy();
  const cards = screen.getAllByTestId(/^post-/);
  expect(cards[0].props.testID).toBe('post-11');
  expect(within(cards[0]).getByText('Two extra reps on the final set.')).toBeTruthy();
  expect(within(cards[0]).getByText('Strength A')).toBeTruthy();
  expect(within(cards[0]).getByLabelText('Post options')).toBeTruthy();
});

test('an already shared workout keeps the caption and description and explains the conflict', async () => {
  jest.mocked(feedApi.create).mockRejectedValue(new ApiError(409));
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: 'New post' }));
  await selectWorkout();
  fireEvent.changeText(screen.getByLabelText('Caption'), 'Keep me');
  fireEvent.changeText(screen.getByLabelText('Description'), 'Keep these notes too');
  fireEvent.press(screen.getByRole('button', { name: 'Share' }));
  expect(
    await screen.findByText('You already shared this workout. Choose another one.'),
  ).toBeTruthy();
  expect(screen.getByLabelText('Caption').props.value).toBe('Keep me');
  expect(screen.getByLabelText('Description').props.value).toBe('Keep these notes too');
});

test('a share request opens the new post screen with that workout selected', async () => {
  const onComposeClosed = jest.fn();
  renderFeed({ composeSessionId: 7, onComposeClosed });
  expect(await screen.findByRole('button', { name: 'Workout to share: Strength A' })).toBeTruthy();
  expect(feedApi.workoutOptions).toHaveBeenCalledWith(7, expect.any(AbortSignal));
  expect(screen.queryByText('Workout saved')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Back to feed' }));
  expect(onComposeClosed).toHaveBeenCalledTimes(1);
});

test('back closes the workout dropdown before prompting to discard composer edits', async () => {
  const callbacks = new Set<Parameters<typeof BackHandler.addEventListener>[1]>();
  const listener = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, callback) => {
    callbacks.add(callback);
    return { remove: () => callbacks.delete(callback) };
  });
  try {
    renderFeed();
    fireEvent.press(await screen.findByRole('button', { name: 'New post' }));
    fireEvent.changeText(screen.getByLabelText('Caption'), 'Keep this');
    fireEvent.press(screen.getByRole('button', { name: 'Workout to share: No workout' }));
    await screen.findByTestId('post-workout-menu');
    fireEvent.press(screen.getByRole('button', { name: 'Close workout menu' }));
    expect(screen.queryByTestId('post-workout-menu')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Workout to share: No workout' }));
    expect(screen.getByTestId('post-workout-menu')).toBeTruthy();
    const modal = screen.UNSAFE_getAllByType(Modal).find((item) => item.props.statusBarTranslucent);
    act(() => modal!.props.onRequestClose());
    expect(screen.queryByTestId('post-workout-menu')).toBeNull();
    expect(screen.queryByText('Discard this post?')).toBeNull();
    await act(async () => {
      [...callbacks].at(-1)?.({ type: 'hardwareBackPress', timeStamp: 0 });
    });
    fireEvent.press(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Caption').props.value).toBe('Keep this');
    fireEvent.press(screen.getByRole('button', { name: 'Back to feed' }));
    fireEvent.press(screen.getByRole('button', { name: 'Discard' }));
    expect(await screen.findByText('Leg day done')).toBeTruthy();
  } finally {
    listener.mockRestore();
  }
});

test('back during a publish request leaves the composer open and preserves the draft on failure', async () => {
  let reject = (_: Error) => {};
  jest.mocked(feedApi.create).mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: 'New post' }));
  fireEvent.changeText(screen.getByLabelText('Caption'), 'An edited caption');
  fireEvent.press(screen.getByRole('button', { name: 'Share' }));
  expect(screen.getByRole('button', { name: 'Back to feed' })).toBeDisabled();
  await act(async () => reject(new Error('offline')));
  expect(screen.getByLabelText('Caption').props.value).toBe('An edited caption');
  fireEvent.press(screen.getByRole('button', { name: 'Back to feed' }));
  expect(screen.getByText('Discard this post?')).toBeTruthy();
});

test('an unavailable history workout is explained without selecting another one', async () => {
  renderFeed({ composeSessionId: 123 });
  expect(await screen.findByText(/The workout you opened is unavailable/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Workout to share: No workout' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Share' })).toBeDisabled();
});

test('a friend must confirm before starting a workout with skipped exercises', async () => {
  const seed = {
    title: 'Strength A',
    exercises: [{ exercise: exampleExercise, sets: [] }],
    skipped_exercises: ['Private move'],
  };
  jest.mocked(feedApi.workoutTemplate).mockResolvedValue(seed);
  const start = jest.fn().mockResolvedValue(true);
  renderFeed({
    workoutActions: {
      activeDraft: false,
      expandedDraft: false,
      available: true,
      start,
      resume: jest.fn(),
    },
  });
  fireEvent.press(await screen.findByLabelText('Post options'));
  expect(screen.queryByRole('button', { name: 'Delete post' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Perform workout' }));
  expect(await screen.findByText(/Private move/)).toBeTruthy();
  expect(start).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Start available exercises' }));
  await waitFor(() => expect(start).toHaveBeenCalledWith(seed));
  expect(feedApi.workoutTemplate).toHaveBeenCalledTimes(1);
});

test('post options offer to resume an active workout without requesting a template', async () => {
  const start = jest.fn();
  const resume = jest.fn();
  jest.mocked(feedApi.posts).mockResolvedValue({
    items: [makePost({ is_mine: true })],
    next_before_id: null,
  });
  renderFeed({
    workoutActions: { activeDraft: true, expandedDraft: false, available: true, start, resume },
  });
  fireEvent.press(await screen.findByLabelText('Post options'));
  fireEvent.press(screen.getByRole('button', { name: 'Resume active workout' }));
  expect(resume).toHaveBeenCalledTimes(1);
  expect(start).not.toHaveBeenCalled();
  expect(feedApi.workoutTemplate).not.toHaveBeenCalled();
});

test('cannot start a shared workout when all exercises are unavailable', async () => {
  jest.mocked(feedApi.workoutTemplate).mockResolvedValue({
    title: 'Strength A',
    exercises: [],
    skipped_exercises: ['Private move'],
  });
  const start = jest.fn();
  jest.mocked(feedApi.posts).mockResolvedValue({
    items: [makePost({ is_mine: true })],
    next_before_id: null,
  });
  renderFeed({
    workoutActions: {
      activeDraft: false,
      expandedDraft: false,
      available: true,
      start,
      resume: jest.fn(),
    },
  });
  fireEvent.press(await screen.findByLabelText('Post options'));
  fireEvent.press(screen.getByRole('button', { name: 'Perform again' }));
  expect(
    await screen.findByText('None of the exercises in this workout are available to you.'),
  ).toBeTruthy();
  expect(start).not.toHaveBeenCalled();
});

test('deleting your post asks first and removes it after confirmation', async () => {
  jest
    .mocked(feedApi.posts)
    .mockResolvedValue({ items: [makePost({ is_mine: true })], next_before_id: null });
  jest.mocked(feedApi.remove).mockRejectedValueOnce(new Error('offline')).mockResolvedValue();
  renderFeed();
  fireEvent.press(await screen.findByLabelText('Post options'));
  expect(screen.getByRole('button', { name: 'Edit post · Coming soon' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Delete post' }));
  expect(screen.getByText('Delete this post?')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(feedApi.remove).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Post options'));
  fireEvent.press(screen.getByRole('button', { name: 'Delete post' }));
  fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
  expect(await screen.findByText('Could not delete the post. Try again.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(screen.queryByText('Leg day done')).toBeNull());
  expect(feedApi.remove).toHaveBeenCalledWith(10);
  expect(await screen.findByText('No posts yet')).toBeTruthy();
});

test('without finished workouts a caption alone can be posted', async () => {
  jest.mocked(feedApi.workoutOptions).mockResolvedValue({ items: [], selected: null });
  const free = makePost({
    id: 12,
    caption: 'Rest day',
    description: '',
    workout: null,
    type: 'GENERAL',
    is_mine: true,
  });
  jest.mocked(feedApi.create).mockResolvedValue(free);
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: 'New post' }));
  fireEvent.press(screen.getByRole('button', { name: 'Workout to share: No workout' }));
  expect(await screen.findByText('No finished workouts available to share.')).toBeTruthy();
  fireEvent.press(
    within(screen.getByTestId('post-workout-menu')).getByRole('button', {
      name: 'No workout',
    }),
  );
  const share = screen.getByRole('button', { name: 'Share' });
  expect(share.props.accessibilityState.disabled).toBe(true);
  fireEvent.changeText(screen.getByLabelText('Caption'), 'Rest day');
  expect(screen.getByRole('button', { name: 'Share' }).props.accessibilityState.disabled).toBe(
    false,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Share' }));
  await waitFor(() =>
    expect(feedApi.create).toHaveBeenCalledWith({
      trainingSessionId: null,
      caption: 'Rest day',
      description: '',
      visibility: 'FRIENDS',
      photos: [],
    }),
  );
  expect(await screen.findByText('Rest day')).toBeTruthy();
});

test('choosing No workout lets a description stand alone', async () => {
  jest.mocked(feedApi.create).mockResolvedValue(makePost({ id: 13, workout: null }));
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: 'New post' }));
  await selectWorkout();
  fireEvent.press(screen.getByRole('button', { name: 'Workout to share: Strength A' }));
  fireEvent.press(
    within(screen.getByTestId('post-workout-menu')).getByRole('button', {
      name: 'No workout',
    }),
  );
  fireEvent.changeText(screen.getByLabelText('Description'), 'Just a thought');
  fireEvent.press(screen.getByRole('button', { name: 'Share' }));
  await waitFor(() =>
    expect(feedApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        trainingSessionId: null,
        caption: '',
        description: 'Just a thought',
      }),
    ),
  );
});

test('the feed only asks for friends posts and an empty feed invites finding friends', async () => {
  const onFindFriends = jest.fn();
  jest.mocked(feedApi.posts).mockResolvedValue({ items: [], next_before_id: null });
  renderFeed({ onFindFriends });
  expect(await screen.findByText('No posts yet')).toBeTruthy();
  expect(screen.getByText('Feed')).toBeTruthy();
  expect(feedApi.posts).toHaveBeenCalledWith(null, expect.any(AbortSignal), 'friends');
  expect(feedApi.posts).not.toHaveBeenCalledWith(null, expect.any(AbortSignal), 'everyone');
  expect(screen.queryByRole('tab', { name: 'Everyone' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Find friends' }));
  expect(onFindFriends).toHaveBeenCalledTimes(1);
});

test('new posts go to friends without asking who can see them', async () => {
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: 'New post' }));
  expect(await screen.findByText('Your friends will see this post in their feed.')).toBeTruthy();
  expect(screen.queryByText('Who can see this')).toBeNull();
  expect(screen.queryByRole('radio', { name: /^Only you/ })).toBeNull();
});

test('tapping an author opens their profile where a friend request can be sent', async () => {
  jest
    .mocked(friendsApi.person)
    .mockResolvedValueOnce({
      id: 2,
      display_name: 'Bob',
      has_picture: false,
      relationship: 'none',
      friend_count: 4,
    })
    .mockResolvedValue({
      id: 2,
      display_name: 'Bob',
      has_picture: false,
      relationship: 'outgoing',
      friend_count: 4,
    });
  jest.mocked(friendsApi.request).mockResolvedValue({ user_id: 2, relationship: 'outgoing' });
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: 'Open Bob’s profile' }));
  expect(await screen.findByText('4 friends')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Add Bob as a friend' }));
  await waitFor(() => expect(friendsApi.request).toHaveBeenCalledWith(2));
  expect(await screen.findByText('Request sent · waiting for Bob')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Back to feed' }));
  expect(await screen.findByText('Leg day done')).toBeTruthy();
});

test('shared posts are sent to friends and not labelled on every card', async () => {
  jest
    .mocked(feedApi.posts)
    .mockResolvedValue({ items: [makePost({ visibility: 'FRIENDS' })], next_before_id: null });
  jest.mocked(feedApi.create).mockResolvedValue(makePost({ id: 20, visibility: 'FRIENDS' }));
  renderFeed();
  expect(await screen.findByText('2 h ago')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'New post' }));
  await selectWorkout();
  fireEvent.press(screen.getByRole('button', { name: 'Share' }));
  await waitFor(() =>
    expect(feedApi.create).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'FRIENDS' })),
  );
});

test('authors with a profile photo show it instead of their initial', async () => {
  const originalReader = globalThis.FileReader;
  class TestReader {
    result = 'data:image/jpeg;base64,aW1hZ2U=';
    readyState = 2;
    onload?: () => void;
    readAsDataURL() {
      this.onload?.();
    }
  }
  globalThis.FileReader = TestReader as unknown as typeof FileReader;
  try {
    jest.mocked(friendsApi.picture).mockResolvedValue(new Blob(['image'], { type: 'image/jpeg' }));
    jest.mocked(feedApi.posts).mockResolvedValue({
      items: [makePost({ author: { id: 2, display_name: 'Bob', has_picture: true } })],
      next_before_id: null,
    });
    const view = renderFeed();
    await screen.findByText('Leg day done');
    await waitFor(() =>
      expect(friendsApi.picture).toHaveBeenCalledWith(2, expect.any(AbortSignal)),
    );
    await waitFor(() =>
      expect(
        view
          .UNSAFE_getAllByType(Image)
          .some((image) => image.props.source?.uri === 'data:image/jpeg;base64,aW1hZ2U='),
      ).toBe(true),
    );
  } finally {
    globalThis.FileReader = originalReader;
  }
});

test('authors without a photo keep their initial and never request one', async () => {
  renderFeed();
  await screen.findByText('Leg day done');
  // The initial is decorative (hidden from screen readers) because the name is shown beside it.
  expect(screen.getByText('B', { includeHiddenElements: true })).toBeTruthy();
  expect(friendsApi.picture).not.toHaveBeenCalled();
});

test('photos can be picked, filtered by type and size, removed and shared', async () => {
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
    granted: true,
  } as never);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [
      { uri: 'file:///a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg', fileSize: 1000 },
      { uri: 'file:///b.gif', fileName: 'b.gif', mimeType: 'image/gif', fileSize: 1000 },
      { uri: 'file:///c.png', mimeType: 'image/png', fileSize: 6 * 1024 * 1024 },
      { uri: 'file:///d.png', mimeType: 'image/png', fileSize: 2000 },
    ],
  } as never);
  jest.mocked(feedApi.create).mockResolvedValue(makePost({ id: 12, is_mine: true }));
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: 'New post' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Add photos' }));
  expect(
    await screen.findByText('2 photos skipped. Use JPEG, PNG or WebP up to 5 MB each.'),
  ).toBeTruthy();
  expect(screen.getByText('Photos · 2/5')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Remove photo 2' }));
  expect(screen.getByText('Photos · 1/5')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Share' }));
  await waitFor(() => expect(feedApi.create).toHaveBeenCalled());
  const input = jest.mocked(feedApi.create).mock.calls[0][0];
  expect(input.photos).toEqual([
    { uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg', file: undefined },
  ]);
});

test('photo requirements are available on demand', async () => {
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: 'New post' }));
  const info = screen.getByRole('button', { name: 'Photo requirements' });
  expect(screen.queryByText(/Location and other photo details/)).toBeNull();
  fireEvent.press(info);
  expect(info.props.accessibilityState.expanded).toBe(true);
  expect(screen.getByText(/Location and other photo details/)).toBeTruthy();
  fireEvent.press(info);
  expect(screen.queryByText(/Location and other photo details/)).toBeNull();
});

test('photo access denial, cancellation and picker failures are explained', async () => {
  const permission = jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync);
  const picker = jest.mocked(ImagePicker.launchImageLibraryAsync);
  permission.mockResolvedValueOnce({ granted: false } as never);
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: 'New post' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Add photos' }));
  expect(
    await screen.findByText('Photo access is needed. Allow access in Settings, then try again.'),
  ).toBeTruthy();
  permission.mockResolvedValue({ granted: true } as never);
  picker.mockResolvedValueOnce({ canceled: true, assets: null } as never);
  fireEvent.press(screen.getByRole('button', { name: 'Add photos' }));
  await waitFor(() => expect(picker).toHaveBeenCalledTimes(1));
  expect(screen.getByText('Photos · 0/5')).toBeTruthy();
  picker.mockRejectedValueOnce(new Error('boom'));
  fireEvent.press(screen.getByRole('button', { name: 'Add photos' }));
  expect(await screen.findByText('Could not open your photos. Try again.')).toBeTruthy();
});

test('your comments can be deleted and older pages load at the end of the list', async () => {
  const comment = (id: number, mine: boolean) => ({
    id,
    post_id: 10,
    author: { id: mine ? 1 : 2, display_name: mine ? 'Alice' : 'Bob', has_picture: false },
    comment: `Comment ${id}`,
    created_at: new Date().toISOString(),
    is_mine: mine,
  });
  jest.mocked(feedApi.posts).mockResolvedValue({
    items: [makePost({ comment_count: 3 })],
    next_before_id: null,
  });
  jest
    .mocked(feedApi.comments)
    .mockResolvedValueOnce({ items: [comment(1, true), comment(2, false)], next_after_id: 2 })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ items: [comment(3, false)], next_after_id: null });
  jest.mocked(feedApi.removeComment).mockResolvedValue(undefined as never);
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: /Comments on post by Bob/ }));
  expect(await screen.findByText('Comment 1')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Delete comment by Bob' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Delete comment by Alice' }));
  await waitFor(() => expect(feedApi.removeComment).toHaveBeenCalledWith(10, 1));
  await waitFor(() => expect(screen.queryByText('Comment 1')).toBeNull());

  const list = screen.UNSAFE_getAllByType(FlatList).at(-1)!;
  act(() => list.props.onEndReached());
  expect(await screen.findByText('Could not load more comments.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Comment 3')).toBeTruthy();
  expect(feedApi.comments).toHaveBeenLastCalledWith(10, 2, expect.any(AbortSignal));
  fireEvent.press(screen.getByRole('button', { name: 'Back to feed' }));
  expect(await screen.findByText('2 comments')).toBeTruthy();
});

test('a failed comment deletion keeps the comment and reports the failure', async () => {
  jest.mocked(feedApi.comments).mockResolvedValue({
    items: [
      {
        id: 1,
        post_id: 10,
        author: { id: 1, display_name: 'Alice', has_picture: false },
        comment: 'Keep this comment',
        created_at: new Date().toISOString(),
        is_mine: true,
      },
    ],
    next_after_id: null,
  });
  jest.mocked(feedApi.removeComment).mockRejectedValueOnce(new Error('offline'));
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: /Comments on post by Bob/ }));
  expect(await screen.findByText('Keep this comment')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Delete comment by Alice' }));

  expect(await screen.findByText('Could not delete the comment. Try again.')).toBeTruthy();
  expect(screen.getByText('Keep this comment')).toBeTruthy();
  expect(feedApi.removeComment).toHaveBeenCalledWith(10, 1);
});

test('Spanish feed localizes comments and keeps post content', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <LanguageProvider language="es">
        <FeedScreen accountId={1} />
      </LanguageProvider>
    </QueryClientProvider>,
  );
  fireEvent.press(await screen.findByRole('button', { name: /Comentarios de la publicación/ }));
  expect(await screen.findByText('Aún no hay comentarios. Inicia la conversación.')).toBeTruthy();
  expect(screen.getByLabelText('Escribe un comentario')).toBeTruthy();
});
