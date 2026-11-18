import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { FlatList } from 'react-native';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { leaguesApi } from '../api';
import { LeagueStandings } from '../components/LeagueStandings';

jest.mock('../api', () => ({
  leaguesApi: {
    rounds: jest.fn(),
    standingsPage: jest.fn(),
    contributions: jest.fn(),
    scoreHistory: jest.fn(),
  },
}));

const currentRound = { id: 2, start_at: '2026-11-15T23:00:00Z', end_at: '2026-11-22T23:00:00Z' };
const pastRound = { id: 1, start_at: '2026-11-08T23:00:00Z', end_at: '2026-11-15T23:00:00Z' };
const alice = {
  user_id: 1,
  display_name: 'Alice',
  picture_url: null,
  score: '9007199254740993',
  position: 1,
};
const bob = { user_id: 2, display_name: 'Bob', picture_url: null, score: '0', position: 2 };
const credited = {
  start_at: currentRound.start_at,
  end_at: currentRound.end_at,
  round_id: 2,
  local_day: '2026-11-17',
  ended_at: '2026-11-17T18:00:00Z',
  score: alice.score,
  session_id: 39,
  calculation: {
    duration_us: '3600000000',
    volume_kg_reps: '500',
    body_weight_kg: '80',
    formula_version: '1',
  },
};

const client = new QueryClient({
  defaultOptions: { queries: { gcTime: Infinity, staleTime: Infinity, retry: false } },
});
afterEach(() => {
  cleanup();
  client.clear();
  jest.clearAllMocks();
});

test('defaults to the current round, loads more rankings and switches period', async () => {
  jest.mocked(leaguesApi.rounds).mockResolvedValue({
    timezone: 'Europe/Madrid',
    current_round_id: 2,
    rounds: [currentRound, pastRound],
  });
  jest.mocked(leaguesApi.standingsPage).mockImplementation(async (_id, roundId, offset) => {
    if (roundId === null) return { items: [{ ...alice, score: '42' }], next_offset: null };
    if (roundId === 1) return { items: [{ ...alice, score: '10' }], next_offset: null };
    return offset === 0 ? { items: [alice], next_offset: 1 } : { items: [bob], next_offset: null };
  });
  const view = render(
    <QueryClientProvider client={client}>
      <LeagueStandings leagueId={9} accountId={1} />
    </QueryClientProvider>,
  );
  expect(
    await screen.findByRole('button', { name: '#1 Alice: 9007199254740993 points, you' }),
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Select round: Current round' })).toBeTruthy();
  act(() => view.UNSAFE_getByType(FlatList).props.onEndReached());
  expect(await screen.findByRole('button', { name: '#2 Bob: 0 points' })).toBeTruthy();
  expect(leaguesApi.standingsPage).toHaveBeenCalledWith(9, 2, 1, expect.anything());
  fireEvent.press(screen.getByRole('tab', { name: 'General' }));
  expect(await screen.findByRole('button', { name: '#1 Alice: 42 points, you' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Select round:/ })).toBeNull();
  fireEvent.press(screen.getByRole('tab', { name: 'Round' }));
  fireEvent.press(screen.getByRole('button', { name: 'Select round: Current round' }));
  fireEvent.press(screen.getByRole('button', { name: /Nov 9, 2026/ }));
  expect(await screen.findByRole('button', { name: '#1 Alice: 10 points, you' })).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'General' }));
  await screen.findByRole('button', { name: '#1 Alice: 42 points, you' });
  fireEvent.press(screen.getByRole('tab', { name: 'Round' }));
  expect(await screen.findByRole('button', { name: '#1 Alice: 10 points, you' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /Select round: Nov 9, 2026/ })).toBeTruthy();
});

test('opens a member page, loads older credited workouts, hides peer calculations and keeps the period on back', async () => {
  jest.mocked(leaguesApi.rounds).mockResolvedValue({
    timezone: 'Europe/Madrid',
    current_round_id: 2,
    rounds: [currentRound, pastRound],
  });
  jest.mocked(leaguesApi.standingsPage).mockResolvedValue({ items: [alice], next_offset: null });
  jest.mocked(leaguesApi.scoreHistory).mockImplementation(async (_id, _user, before) =>
    before
      ? {
          items: [
            { ...credited, ...pastRound, round_id: 1, local_day: '2026-11-10', session_id: 11 },
          ],
          next_before: null,
        }
      : { items: [credited], next_before: credited.local_day },
  );
  const view = render(
    <QueryClientProvider client={client}>
      <LeagueStandings leagueId={9} accountId={2} />
    </QueryClientProvider>,
  );
  await screen.findByRole('button', { name: /#1 Alice/ });
  fireEvent.press(screen.getByRole('tab', { name: 'General' }));
  fireEvent.press(await screen.findByRole('button', { name: /#1 Alice/ }));
  await screen.findByRole('header', { name: 'Score history' });
  expect(await screen.findByText('Workout #39')).toBeTruthy();
  expect(screen.queryByText(/Body weight/)).toBeNull();
  act(() => view.UNSAFE_getByType(FlatList).props.onEndReached());
  expect(await screen.findByText('Workout #11')).toBeTruthy();
  expect(leaguesApi.scoreHistory).toHaveBeenCalledWith(9, 1, '2026-11-17', expect.anything());
  fireEvent.press(screen.getByRole('button', { name: 'Back to standings' }));
  expect(screen.getByRole('tab', { name: 'General', selected: true })).toBeTruthy();
});

test('one round still offers all-time standings and the breakdown pages match the selected period', async () => {
  jest
    .mocked(leaguesApi.rounds)
    .mockResolvedValue({ timezone: 'Europe/Madrid', current_round_id: 2, rounds: [currentRound] });
  jest.mocked(leaguesApi.standingsPage).mockResolvedValue({ items: [alice], next_offset: null });
  jest.mocked(leaguesApi.contributions).mockImplementation(async (_id, roundId, offset) => ({
    items: [
      {
        ...credited,
        user_id: 1,
        display_name: 'Alice',
        picture_url: null,
        session_id: offset ? 40 : roundId === null ? 38 : 39,
        local_day: offset ? '2026-11-16' : credited.local_day,
      },
    ],
    next_offset: offset || roundId === null ? null : 1,
  }));
  const view = render(
    <QueryClientProvider client={client}>
      <LeagueStandings leagueId={9} accountId={1} />
    </QueryClientProvider>,
  );
  const picker = await screen.findByRole('button', { name: 'Select round: Current round' });
  fireEvent.press(picker);
  expect(screen.getByRole('button', { name: 'Current round', selected: true })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'General standings' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Close select round' }));
  fireEvent.press(screen.getByRole('tab', { name: 'Points breakdown' }));
  expect(await screen.findByText(/Workout #39/)).toBeTruthy();
  expect(screen.getByText(/Body weight 80 kg/)).toBeTruthy();
  act(() => view.UNSAFE_getByType(FlatList).props.onEndReached());
  expect(await screen.findByText(/Workout #40/)).toBeTruthy();
  expect(leaguesApi.contributions).toHaveBeenCalledWith(9, 2, 1, expect.anything());
  fireEvent.press(screen.getByRole('tab', { name: 'General' }));
  expect(await screen.findByText(/Workout #38/)).toBeTruthy();
  expect(screen.queryByText(/Workout #40/)).toBeNull();
  expect(leaguesApi.contributions).toHaveBeenCalledWith(9, null, 0, expect.anything());
  fireEvent.press(screen.getByRole('tab', { name: 'Round' }));
  expect(await screen.findByText(/Workout #39/)).toBeTruthy();
  expect(screen.queryByText(/Workout #38/)).toBeNull();
});
