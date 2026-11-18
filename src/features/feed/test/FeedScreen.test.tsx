import React from 'react';
import { FlatList, Image } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { ApiError } from '@/services/apiClient';
import { trainingApi } from '@/features/training/api';
import { friendsApi } from '@/features/friends/api';
import { feedApi } from '../api';
import { FeedScreen } from '../components/FeedScreen';
import { makePost } from './fixtures';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('@/features/training/api', () => ({ trainingApi: { sessions: jest.fn() } }));
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
    create: jest.fn(),
    remove: jest.fn(),
    like: jest.fn(),
    comments: jest.fn(),
    addComment: jest.fn(),
    removeComment: jest.fn(),
    media: jest.fn(),
    workout: jest.fn(),
  },
}));

// Composer flows have many interactions; allow for slower machines.
jest.setTimeout(20000);

const workout = {
  id: 7,
  ended_at: '2026-11-09T16:45:00Z',
  exercises: [{ id: 1, exercise: { name: 'Bench press' }, sets: [{}, {}] }],
};

function renderFeed(props: Partial<React.ComponentProps<typeof FeedScreen>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <FeedScreen accountId={1} {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(feedApi.posts).mockResolvedValue({ items: [makePost()], next_before_id: null });
  jest.mocked(feedApi.comments).mockResolvedValue({ items: [], next_after_id: null });
  jest
    .mocked(trainingApi.sessions)
    .mockResolvedValue({ items: [workout], limit: 50, offset: 0 } as never);
});

test('feed shows the author, caption, workout summary and counts', async () => {
  renderFeed();
  expect(await screen.findByText('Bob')).toBeTruthy();
  expect(screen.getByText('Leg day done')).toBeTruthy();
  expect(screen.getByText('2 h ago')).toBeTruthy();
  expect(screen.getByText('45 min')).toBeTruthy();
  expect(screen.getByText('1,312.5 kg')).toBeTruthy();
  expect(screen.getByText('Bench press · Squat')).toBeTruthy();
  expect(screen.getByText('2 likes')).toBeTruthy();
  expect(screen.queryByLabelText('Delete your post')).toBeNull();
  expect(feedApi.posts).toHaveBeenCalledWith(null, expect.any(AbortSignal), 'friends');
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
      items: [makePost({ id: 9, text: 'Older session' })],
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
  fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByText('Strong work')).toBeTruthy();
  expect(feedApi.addComment).toHaveBeenCalledWith(10, 'Strong work');
  expect(screen.getByLabelText('Write a comment').props.value).toBe('');
  fireEvent.press(screen.getByRole('button', { name: 'Back to feed' }));
  expect(await screen.findByText('1 comment')).toBeTruthy();
});

test('tapping a shared workout shows every exercise and set', async () => {
  const summary = makePost().workout!;
  jest.mocked(feedApi.workout).mockResolvedValue({
    ...summary,
    detailed_exercises: [
      {
        exercise_id: 3,
        name: 'Bench press',
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
  expect(within(bench).getByText('Bench press')).toBeTruthy();
  expect(within(bench).getByText('8 reps × 100 kg')).toBeTruthy();
  expect(within(bench).getByText('5 reps × 62.5 kg')).toBeTruthy();
  expect(within(screen.getByTestId('workout-exercise-1')).getByText('45 s')).toBeTruthy();
  expect(screen.getByText('23')).toBeTruthy();
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

test('failed comment keeps the text', async () => {
  jest.mocked(feedApi.addComment).mockRejectedValue(new Error('offline'));
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: /Comments on post by Bob/ }));
  fireEvent.changeText(await screen.findByLabelText('Write a comment'), 'Nice');
  fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(
    await screen.findByText('Could not post your comment. Your text is kept. Try again.'),
  ).toBeTruthy();
  expect(screen.getByLabelText('Write a comment').props.value).toBe('Nice');
});

test('sharing a workout posts it and shows it first in the feed', async () => {
  const shared = makePost({
    id: 11,
    text: 'New PR',
    is_mine: true,
    author: { id: 1, display_name: 'Alice', has_picture: false },
  });
  jest.mocked(feedApi.create).mockResolvedValue(shared);
  renderFeed();
  await screen.findByText('Leg day done');
  fireEvent.press(screen.getByRole('button', { name: 'New post' }));
  const option = await screen.findByRole('radio', { name: /Workout finished/ });
  expect(option.props.accessibilityState.checked).toBe(true);
  fireEvent.changeText(screen.getByLabelText('Caption'), 'New PR');
  fireEvent.press(screen.getByRole('button', { name: 'Share' }));
  await waitFor(() =>
    expect(feedApi.create).toHaveBeenCalledWith({
      trainingSessionId: 7,
      text: 'New PR',
      visibility: 'FRIENDS',
      photos: [],
    }),
  );
  expect(await screen.findByText('New PR')).toBeTruthy();
  const cards = screen.getAllByTestId(/^post-/);
  expect(cards[0].props.testID).toBe('post-11');
  expect(within(cards[0]).getByLabelText('Delete your post')).toBeTruthy();
});

test('an already shared workout keeps the caption and explains the conflict', async () => {
  jest.mocked(feedApi.create).mockRejectedValue(new ApiError(409));
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: 'New post' }));
  await screen.findByRole('radio', { name: /Workout finished/ });
  fireEvent.changeText(screen.getByLabelText('Caption'), 'Keep me');
  fireEvent.press(screen.getByRole('button', { name: 'Share' }));
  expect(
    await screen.findByText('You already shared this workout. Choose another one.'),
  ).toBeTruthy();
  expect(screen.getByLabelText('Caption').props.value).toBe('Keep me');
});

test('a share request opens the new post screen with that workout selected', async () => {
  const onComposeClosed = jest.fn();
  renderFeed({ composeSessionId: 7, onComposeClosed });
  const option = await screen.findByRole('radio', { name: /Workout finished/ });
  expect(option.props.accessibilityState.checked).toBe(true);
  expect(screen.queryByText('Workout saved')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Back to feed' }));
  expect(onComposeClosed).toHaveBeenCalledTimes(1);
});

test('deleting your post asks first and removes it after confirmation', async () => {
  jest
    .mocked(feedApi.posts)
    .mockResolvedValue({ items: [makePost({ is_mine: true })], next_before_id: null });
  jest.mocked(feedApi.remove).mockRejectedValueOnce(new Error('offline')).mockResolvedValue();
  renderFeed();
  fireEvent.press(await screen.findByLabelText('Delete your post'));
  expect(screen.getByText('Delete this post?')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(feedApi.remove).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Delete your post'));
  fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
  expect(await screen.findByText('Could not delete the post. Try again.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(screen.queryByText('Leg day done')).toBeNull());
  expect(feedApi.remove).toHaveBeenCalledWith(10);
  expect(await screen.findByText('No posts yet')).toBeTruthy();
});

test('without finished workouts a caption alone can be posted', async () => {
  jest.mocked(trainingApi.sessions).mockResolvedValue({ items: [], limit: 50, offset: 0 } as never);
  const free = makePost({
    id: 12,
    text: 'Rest day',
    workout: null,
    type: 'GENERAL',
    is_mine: true,
  });
  jest.mocked(feedApi.create).mockResolvedValue(free);
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: 'New post' }));
  expect(
    await screen.findByText('No finished workouts yet. You can still post a caption or photos.'),
  ).toBeTruthy();
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
      text: 'Rest day',
      visibility: 'FRIENDS',
      photos: [],
    }),
  );
  expect(await screen.findByText('Rest day')).toBeTruthy();
});

test('choosing No workout posts without the suggested workout', async () => {
  jest.mocked(feedApi.create).mockResolvedValue(makePost({ id: 13, workout: null }));
  renderFeed();
  fireEvent.press(await screen.findByRole('button', { name: 'New post' }));
  await screen.findByRole('radio', { name: /Workout finished/ });
  fireEvent.press(screen.getByRole('radio', { name: /No workout/ }));
  fireEvent.changeText(screen.getByLabelText('Caption'), 'Just a thought');
  fireEvent.press(screen.getByRole('button', { name: 'Share' }));
  await waitFor(() =>
    expect(feedApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ trainingSessionId: null, text: 'Just a thought' }),
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
  await screen.findByRole('radio', { name: /Workout finished/ });
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
