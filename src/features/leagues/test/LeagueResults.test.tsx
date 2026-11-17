import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { leaguesApi } from '../api';
import { LeagueResults } from '../components/LeagueResults';

jest.mock('../api', () => ({ leaguesApi: { pendingResults: jest.fn(), acknowledge: jest.fn() } }));
const pending = jest.mocked(leaguesApi.pendingResults);
const acknowledge = jest.mocked(leaguesApi.acknowledge);
const results = [1, 2].map((id) => ({
  id,
  round_id: id,
  start_at: `2026-11-${id === 1 ? '02' : '09'}T00:00:00Z`,
  end_at: `2026-11-${id === 1 ? '09' : '16'}T00:00:00Z`,
  standings: [
    { user_id: 1, display_name: 'Alice', score: '0', position: 1 },
    { user_id: 2, display_name: 'Bob', score: '0', position: 1 },
  ],
  loser_user_ids: [1, 2],
}));
const resultRange = (index: number) => {
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
  return `${date.format(new Date(results[index].start_at))} – ${date.format(new Date(results[index].end_at))}`;
};
const clients: QueryClient[] = [];
function makeClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  clients.push(client);
  return client;
}
function setup(accountId = 1, client = makeClient()) {
  return render(
    <QueryClientProvider client={client}>
      <LeagueResults accountId={accountId} leagueId={9} />
    </QueryClientProvider>,
  );
}
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});
beforeEach(() => {
  jest.clearAllMocks();
});

test('displays oldest result without acknowledging, retries failure, then advances', async () => {
  pending.mockResolvedValueOnce(results).mockResolvedValue([results[1]]);
  acknowledge.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  setup();
  expect(await screen.findByText(resultRange(0))).toBeTruthy();
  expect(screen.getByText('Lowest score: Alice, Bob')).toBeTruthy();
  expect(acknowledge).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByText(resultRange(0))).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
  expect(await screen.findByText(resultRange(1))).toBeTruthy();
  expect(acknowledge).toHaveBeenCalledWith(9, 1);
  await waitFor(() => expect(pending).toHaveBeenCalledTimes(2));
});

test('uses separate account keys and shows a round with no loser', async () => {
  pending.mockResolvedValueOnce([{ ...results[0], loser_user_ids: [] }]).mockResolvedValueOnce([]);
  const client = makeClient();
  const first = setup(1, client);
  expect(await screen.findByText('No losing outcome for this round.')).toBeTruthy();
  first.unmount();
  setup(2, client);
  await waitFor(() =>
    expect(client.getQueryState(['leagues', 2, 9, 'results', 'pending'])?.status).toBe('success'),
  );
  expect(pending).toHaveBeenCalledTimes(2);
  expect(screen.queryByText('Round result')).toBeNull();
  expect(acknowledge).not.toHaveBeenCalled();
});

test('does not fetch or display results while the league tab is hidden', async () => {
  pending.mockResolvedValue(results);
  const client = makeClient();
  const view = render(
    <QueryClientProvider client={client}>
      <LeagueResults accountId={1} leagueId={9} active={false} />
    </QueryClientProvider>,
  );
  expect(pending).not.toHaveBeenCalled();
  view.rerender(
    <QueryClientProvider client={client}>
      <LeagueResults accountId={1} leagueId={9} active />
    </QueryClientProvider>,
  );
  expect(await screen.findByText(resultRange(0))).toBeTruthy();
  view.rerender(
    <QueryClientProvider client={client}>
      <LeagueResults accountId={1} leagueId={9} active={false} />
    </QueryClientProvider>,
  );
  expect(screen.queryByText('Round result')).toBeNull();
  expect(acknowledge).not.toHaveBeenCalled();
});
