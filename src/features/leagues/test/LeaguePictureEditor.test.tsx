import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { leaguesApi } from '../api';
import { leagueDetailSchema } from '../schemas';
import { LeaguePictureEditor } from '../components/LeaguePictureEditor';
import { pickLeaguePicture } from '../components/leaguePicture';

jest.mock('../api', () => ({ leaguesApi: { uploadPicture: jest.fn(), removePicture: jest.fn() } }));
jest.mock('../components/leaguePicture', () => ({
  pickLeaguePicture: jest.fn(),
  leaguePictureForm: jest.fn(() => new FormData()),
}));
jest.mock('../components/LeagueAvatar', () => ({ LeagueAvatar: () => null }));
const league = leagueDetailSchema.parse({
  id: 9,
  name: 'Early birds',
  timezone: 'UTC',
  role: 'admin',
  picture_url: null,
  created_at: '2026-11-17T10:00:00Z',
  members: [],
});
const client = new QueryClient({
  defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
});
afterEach(() => {
  cleanup();
  client.clear();
  jest.clearAllMocks();
});

test('retains a selected picture after upload failure, retries, then updates the league cache', async () => {
  const updated = { ...league, picture_url: '/api/v1/leagues/9/picture?v=abc' };
  jest
    .mocked(pickLeaguePicture)
    .mockResolvedValue({ asset: { uri: 'file:///picture.png', width: 64, height: 64 } });
  jest
    .mocked(leaguesApi.uploadPicture)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(updated);
  const onBusy = jest.fn();
  render(
    <QueryClientProvider client={client}>
      <LeaguePictureEditor accountId={1} league={league} onBusy={onBusy} />
    </QueryClientProvider>,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Choose league picture' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Save picture' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByText('New picture · Save to apply')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Save picture' }));
  await waitFor(() => expect(client.getQueryData(['leagues', 1, 9])).toEqual(updated));
  expect(screen.queryByText('New picture · Save to apply')).toBeNull();
  expect(leaguesApi.uploadPicture).toHaveBeenCalledTimes(2);
  expect(onBusy).toHaveBeenLastCalledWith(false);
});

test('removal is applied only after the server succeeds', async () => {
  jest
    .mocked(leaguesApi.removePicture)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(league);
  const existing = { ...league, picture_url: '/api/v1/leagues/9/picture?v=abc' };
  client.setQueryData(['leagues', 1, 9], existing);
  render(
    <QueryClientProvider client={client}>
      <LeaguePictureEditor accountId={1} league={existing} onBusy={jest.fn()} />
    </QueryClientProvider>,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Remove league picture' }));
  await screen.findByRole('alert');
  expect(client.getQueryData(['leagues', 1, 9])).toEqual(existing);
  fireEvent.press(screen.getByRole('button', { name: 'Remove league picture' }));
  await waitFor(() => expect(client.getQueryData(['leagues', 1, 9])).toEqual(league));
});
