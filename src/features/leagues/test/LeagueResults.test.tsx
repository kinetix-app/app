import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { leaguesApi } from '../api';
import { LeagueResults } from '../components/LeagueResults';

jest.mock('../api', () => ({ leaguesApi: { pendingResults: jest.fn(), acknowledge: jest.fn() } }));
const pending = jest.mocked(leaguesApi.pendingResults);
const acknowledge = jest.mocked(leaguesApi.acknowledge);
const results = [1, 2].map((id) => ({
  id,
  round_id: id,
  start_at: `start-${id}`,
  end_at: `end-${id}`,
  standings: [
    { user_id: 1, display_name: 'Alice', score: '0', position: 1 },
    { user_id: 2, display_name: 'Bob', score: '0', position: 1 },
  ],
  loser_user_ids: [1, 2],
}));
function setup(
  accountId = 1,
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  }),
) {
  return render(
    <QueryClientProvider client={client}>
      <LeagueResults accountId={accountId} leagueId={9} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
});

test('displays oldest result without acknowledging, retries failure, then advances', async () => {
  pending.mockResolvedValueOnce(results).mockResolvedValue([results[1]]);
  acknowledge.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  setup();
  expect(await screen.findByText('start-1 – end-1')).toBeTruthy();
  expect(screen.getByText('Lowest score: Alice, Bob')).toBeTruthy();
  expect(acknowledge).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByText('start-1 – end-1')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
  expect(await screen.findByText('start-2 – end-2')).toBeTruthy();
  expect(acknowledge).toHaveBeenCalledWith(9, 1);
});

test('uses separate account keys and shows a round with no loser', async () => {
  pending.mockResolvedValueOnce([{ ...results[0], loser_user_ids: [] }]).mockResolvedValueOnce([]);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const first = setup(1, client);
  expect(await screen.findByText('No losing outcome for this round.')).toBeTruthy();
  first.unmount();
  setup(2, client);
  await waitFor(() => expect(pending).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('Round result')).toBeNull();
  expect(acknowledge).not.toHaveBeenCalled();
});
