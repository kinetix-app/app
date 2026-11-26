import React from 'react';
import { LanguageProvider } from '@/i18n/Language';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { friendsApi } from '../api';
import { FriendsScreen } from '../components/FriendsScreen';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  friendsApi: {
    friends: jest.fn(),
    requests: jest.fn(),
    search: jest.fn(),
    person: jest.fn(),
    request: jest.fn(),
    accept: jest.fn(),
    remove: jest.fn(),
  },
}));

// The first render loads every screen module; allow cold starts on slower machines.
jest.setTimeout(20000);

const bob = { id: 2, display_name: 'Bob', has_picture: false };
const carol = { id: 3, display_name: 'Carol', has_picture: false };

const clients: QueryClient[] = [];

function renderFriends(props: Partial<React.ComponentProps<typeof FriendsScreen>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <FriendsScreen accountId={1} onClose={jest.fn()} {...props} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(friendsApi.friends).mockResolvedValue({
    items: [{ user: bob, since: '2026-11-01T10:00:00Z' }],
    limit: 50,
    offset: 0,
  });
  jest.mocked(friendsApi.requests).mockResolvedValue({
    incoming: [{ user: carol, created_at: '2026-11-15T10:00:00Z' }],
    outgoing: [],
  });
  jest.mocked(friendsApi.remove).mockResolvedValue(undefined);
});

test('friends list opens a person and removing asks for confirmation', async () => {
  jest
    .mocked(friendsApi.person)
    .mockResolvedValue({ ...bob, relationship: 'friends', friend_count: 1 });
  renderFriends();
  expect(await screen.findByText('Bob')).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Requests (1)' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Open Bob’s profile' }));
  expect(await screen.findByText('You are friends')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Remove Bob from friends' }));
  expect(screen.getByText('Remove Bob?')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(friendsApi.remove).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Remove Bob from friends' }));
  fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
  await waitFor(() => expect(friendsApi.remove).toHaveBeenCalledWith(2));
  fireEvent.press(screen.getByRole('button', { name: 'Back to friends' }));
  expect(await screen.findByRole('tab', { name: 'Find' })).toBeTruthy();
});

test('incoming requests can be accepted and refresh from the server', async () => {
  jest.mocked(friendsApi.accept).mockResolvedValue({ user_id: 3, relationship: 'friends' });
  renderFriends({ initialTab: 'requests' });
  expect(await screen.findByText('Wants to be your friend')).toBeTruthy();
  jest.mocked(friendsApi.requests).mockResolvedValue({ incoming: [], outgoing: [] });
  fireEvent.press(screen.getByRole('button', { name: 'Accept friend request from Carol' }));
  await waitFor(() => expect(friendsApi.accept).toHaveBeenCalledWith(3));
  expect(await screen.findByText('No pending friend requests.')).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Requests' })).toBeTruthy();
});

test('a failed action keeps the request and explains the error', async () => {
  jest.mocked(friendsApi.remove).mockRejectedValue(new Error('offline'));
  renderFriends({ initialTab: 'requests' });
  fireEvent.press(await screen.findByRole('button', { name: 'Decline friend request from Carol' }));
  expect(await screen.findByText('Could not update this friendship. Try again.')).toBeTruthy();
  expect(screen.getByText('Wants to be your friend')).toBeTruthy();
});

test('search waits for two letters, debounces and sends a request', async () => {
  jest.useFakeTimers();
  try {
    jest.mocked(friendsApi.search).mockResolvedValue({
      items: [{ id: 4, display_name: 'Dana', has_picture: false, relationship: 'none' }],
    });
    jest.mocked(friendsApi.request).mockResolvedValue({ user_id: 4, relationship: 'outgoing' });
    renderFriends({ initialTab: 'find' });
    const field = await screen.findByLabelText('Search people by name');
    fireEvent.changeText(field, 'D');
    await act(async () => jest.advanceTimersByTime(400));
    expect(friendsApi.search).not.toHaveBeenCalled();
    expect(screen.getByText('Type at least 2 letters of a name.')).toBeTruthy();
    fireEvent.changeText(field, 'Da');
    fireEvent.changeText(field, 'Dan');
    await act(async () => jest.advanceTimersByTime(400));
    expect(friendsApi.search).toHaveBeenCalledTimes(1);
    expect(friendsApi.search).toHaveBeenCalledWith('Dan', expect.any(AbortSignal));
    fireEvent.press(await screen.findByRole('button', { name: 'Add Dana as a friend' }));
    await waitFor(() => expect(friendsApi.request).toHaveBeenCalledWith(4));
  } finally {
    jest.useRealTimers();
  }
});

test('Spanish localizes friend requests and preserves names', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <LanguageProvider language="es">
        <FriendsScreen accountId={1} onClose={jest.fn()} initialTab="requests" />
      </LanguageProvider>
    </QueryClientProvider>,
  );
  expect(await screen.findByText('Quiere ser tu amigo')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Aceptar solicitud de amistad de Carol' }),
  ).toBeTruthy();
});
