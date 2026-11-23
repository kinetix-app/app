import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { AccessibilityInfo, FlatList, View } from 'react-native';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { trainingApi } from '@/features/training/api';
import { exampleExercise } from '@/features/training/test/fixtures';
import { leaguesApi } from '../api';
import { LeagueStandings } from '../components/LeagueStandings';

jest.mock('@/features/training/api', () => ({ trainingApi: { session: jest.fn() } }));

jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
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
    volume_kg_reps: '690.0000000',
    body_weight_kg: '80.1235',
    formula_version: '1',
  },
};

const client = new QueryClient({
  defaultOptions: { queries: { gcTime: 0, staleTime: 30000, retry: false } },
});
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  jest.spyOn(View.prototype, 'measureInWindow').mockImplementation((measure) => {
    if (typeof measure === 'function') measure(16, 160, 358, 64);
  });
});

afterEach(() => {
  cleanup();
  client.clear();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

function selectRound(current: string | RegExp, next: string | RegExp) {
  const name = typeof current === 'string' ? `Select round: ${current}` : current;
  fireEvent.press(screen.getByRole('button', { name }));
  fireEvent.press(screen.getByRole('button', { name: next }));
}

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
  expect(screen.queryByRole('tab', { name: 'General' })).toBeNull();
  selectRound('Current round', 'All rounds');
  expect(await screen.findByRole('button', { name: '#1 Alice: 42 points, you' })).toBeTruthy();
  expect(leaguesApi.standingsPage).toHaveBeenCalledWith(9, null, 0, expect.anything());
  expect(
    screen.getByRole('button', { name: 'Select round: All rounds', expanded: false }),
  ).toBeTruthy();
  selectRound('All rounds', /Nov 9, 2026/);
  expect(await screen.findByRole('button', { name: '#1 Alice: 10 points, you' })).toBeTruthy();
  selectRound(/Nov 9, 2026/, 'Current round');
  expect(
    await screen.findByRole('button', { name: '#1 Alice: 9007199254740993 points, you' }),
  ).toBeTruthy();
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
  selectRound('Current round', 'All rounds');
  fireEvent.press(await screen.findByRole('button', { name: /#1 Alice/ }));
  await screen.findByRole('header', { name: 'Score history' });
  expect(await screen.findByText('Workout #39')).toBeTruthy();
  expect(screen.queryByText(/Body weight/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'View workout 39' })).toBeNull();
  expect(trainingApi.session).not.toHaveBeenCalled();
  act(() => view.UNSAFE_getByType(FlatList).props.onEndReached());
  expect(await screen.findByText('Workout #11')).toBeTruthy();
  expect(leaguesApi.scoreHistory).toHaveBeenCalledWith(9, 1, '2026-11-17', expect.anything());
  fireEvent.press(screen.getByRole('button', { name: 'Back to standings' }));
  expect(screen.getByRole('button', { name: 'Select round: All rounds' })).toBeTruthy();
});

test('one round still offers all-time standings and the breakdown pages match the selected period', async () => {
  jest
    .mocked(leaguesApi.rounds)
    .mockResolvedValue({ timezone: 'Europe/Madrid', current_round_id: 2, rounds: [currentRound] });
  jest.mocked(leaguesApi.standingsPage).mockResolvedValue({ items: [alice], next_offset: null });
  jest.mocked(leaguesApi.scoreHistory).mockResolvedValue({ items: [credited], next_before: null });
  jest.mocked(trainingApi.session).mockResolvedValue({
    id: 39,
    client_session_id: null,
    routine_id: null,
    started_at: '2026-11-17T17:00:00Z',
    ended_at: credited.ended_at,
    activity_type: 'gym',
    state: 'completed',
    title: 'Training session',
    exercises: [{ id: 1, exercise_order: 1, exercise: exampleExercise, sets: [] }],
  });
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
  expect(screen.getByRole('button', { name: 'All rounds' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Close round menu' }));
  expect(screen.queryByRole('button', { name: /^All rounds$/ })).toBeNull();
  fireEvent.press(screen.getByRole('tab', { name: 'Points breakdown' }));
  expect(await screen.findByText(/Workout #39/)).toBeTruthy();
  const calculation = 'Volume 690 kg reps · Duration 1 h · Body weight 80.124 kg';
  expect(screen.getByText(calculation)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'View score history for Alice' }));
  expect(await screen.findByText(calculation)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'View workout 39' }));
  expect(await screen.findByText('1. Bench press')).toBeTruthy();
  expect(trainingApi.session).toHaveBeenCalledWith(39, 'kg', expect.any(AbortSignal));
  fireEvent.press(screen.getByRole('button', { name: 'Back to score history' }));
  fireEvent.press(screen.getByRole('button', { name: 'Back to standings' }));
  expect(screen.getByRole('tab', { name: 'Points breakdown', selected: true })).toBeTruthy();
  act(() => view.UNSAFE_getByType(FlatList).props.onEndReached());
  expect(await screen.findByText(/Workout #40/)).toBeTruthy();
  expect(leaguesApi.contributions).toHaveBeenCalledWith(9, 2, 1, expect.anything());
  selectRound('Current round', 'All rounds');
  expect(await screen.findByText(/Workout #38/)).toBeTruthy();
  expect(screen.queryByText(/Workout #40/)).toBeNull();
  expect(leaguesApi.contributions).toHaveBeenCalledWith(9, null, 0, expect.anything());
  selectRound('All rounds', 'Current round');
  expect(await screen.findByText(/Workout #39/)).toBeTruthy();
  expect(screen.queryByText(/Workout #38/)).toBeNull();
  expect(
    jest
      .mocked(leaguesApi.contributions)
      .mock.calls.filter(([, id, offset]) => id === 2 && offset === 0),
  ).toHaveLength(1);
});

test('retries the failed rounds request before loading the standings', async () => {
  jest.mocked(leaguesApi.rounds).mockRejectedValueOnce(new Error('Offline'));
  jest.mocked(leaguesApi.rounds).mockResolvedValue({
    timezone: 'Europe/Madrid',
    current_round_id: currentRound.id,
    rounds: [currentRound],
  });
  jest.mocked(leaguesApi.standingsPage).mockResolvedValue({ items: [alice], next_offset: null });
  render(
    <QueryClientProvider client={client}>
      <LeagueStandings leagueId={9} accountId={1} />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load standings.');
  expect(leaguesApi.standingsPage).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Retry standings' }));
  expect(await screen.findByRole('button', { name: /#1 Alice:/ })).toBeVisible();
  expect(leaguesApi.rounds).toHaveBeenCalledTimes(2);
  expect(leaguesApi.standingsPage).toHaveBeenCalledTimes(1);
});

test('retries the standings page without refetching available rounds', async () => {
  jest.mocked(leaguesApi.rounds).mockResolvedValue({
    timezone: 'Europe/Madrid',
    current_round_id: currentRound.id,
    rounds: [currentRound],
  });
  jest.mocked(leaguesApi.standingsPage).mockRejectedValueOnce(new Error('Offline'));
  jest.mocked(leaguesApi.standingsPage).mockResolvedValue({ items: [alice], next_offset: null });
  render(
    <QueryClientProvider client={client}>
      <LeagueStandings leagueId={9} accountId={1} />
    </QueryClientProvider>,
  );
  fireEvent.press(await screen.findByRole('button', { name: 'Retry standings' }));
  expect(await screen.findByRole('button', { name: /#1 Alice:/ })).toBeVisible();
  expect(leaguesApi.rounds).toHaveBeenCalledTimes(1);
  expect(leaguesApi.standingsPage).toHaveBeenCalledTimes(2);
});
