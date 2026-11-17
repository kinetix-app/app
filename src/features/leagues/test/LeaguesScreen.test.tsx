import React from 'react';
import { Text as MockText } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { leaguesApi } from '../api';
import { leagueDetailSchema } from '../schemas';
import { LeaguesScreen } from '../components/LeaguesScreen';

jest.mock('../api', () => ({ leaguesApi: { list: jest.fn(), detail: jest.fn() } }));
jest.mock('../components/LeagueResults', () => ({ LeagueResults: () => null }));
jest.mock('../components/LeagueStandings', () => ({
  LeagueStandings: () => <MockText>Standings content</MockText>,
}));
const clients: QueryClient[] = [];
function setup(role: 'admin' | 'member', position: number | null = 2, memberCount = 2) {
  const league = leagueDetailSchema.parse({
    id: 9,
    name: 'Early birds',
    picture_url: null,
    timezone: 'Europe/Madrid',
    role,
    created_at: '2026-11-17T10:00:00Z',
    members: [
      { user_id: 1, display_name: 'Alex', role: 'admin', joined_at: null },
      { user_id: 2, display_name: 'Sam', role: 'member', joined_at: null },
    ],
  });
  jest
    .mocked(leaguesApi.list)
    .mockResolvedValue([{ ...league, member_count: memberCount, current_week_position: position }]);
  jest.mocked(leaguesApi.detail).mockResolvedValue(league);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <LeaguesScreen accountId={role === 'admin' ? 1 : 2} />
    </QueryClientProvider>,
  );
}
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  jest.clearAllMocks();
});

test('league identity opens information with admin configuration and back returns to standings', async () => {
  setup('admin');
  fireEvent.press(await screen.findByRole('button', { name: 'Early birds' }));
  expect(await screen.findByRole('header', { name: 'Early birds' })).toBeTruthy();
  expect(screen.queryByRole('header', { name: 'League' })).toBeNull();
  expect(await screen.findByText('Standings content')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Rename league' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'View league information for Early birds' }));
  expect(screen.getByRole('header', { name: 'League information' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Choose league picture' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Rename league' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Generate invitation' })).toBeTruthy();
  expect(screen.getByText('Daily credit')).toBeTruthy();
  expect(screen.getByLabelText('Alex profile picture unavailable')).toBeTruthy();
  expect(screen.getByLabelText('Sam profile picture unavailable')).toBeTruthy();
  expect(screen.getByText('Admin')).toBeTruthy();
  expect(screen.getByText('Member')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Back to league' }));
  expect(screen.getByText('Standings content')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Back to leagues' }));
  expect(await screen.findByRole('header', { name: 'Your leagues' })).toBeTruthy();
});

test('members can view concise rules and identities without admin controls', async () => {
  setup('member');
  fireEvent.press(await screen.findByRole('button', { name: 'Early birds' }));
  await screen.findByText('Standings content');
  fireEvent.press(screen.getByRole('button', { name: 'View league information for Early birds' }));
  expect(screen.getByRole('header', { name: 'Members' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Choose league picture' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Rename league' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Generate invitation' })).toBeNull();
});

test('league list cards show the picture, weekly position and total members', async () => {
  setup('member', 2, 8);
  const card = await screen.findByRole('button', { name: 'Early birds' });
  expect(screen.getByLabelText('Default league picture')).toBeTruthy();
  expect(screen.getByText('#2 this week')).toBeTruthy();
  expect(screen.getByText('8 members')).toBeTruthy();
  expect(card.props.accessibilityHint).toContain('Your position this week is 2, 8 members');
});

test('unconfigured weekly rankings show an unavailable state and singular member count', async () => {
  setup('admin', null, 1);
  await screen.findByRole('button', { name: 'Early birds' });
  expect(screen.getByText('Weekly rank unavailable')).toBeTruthy();
  expect(screen.getByText('1 member')).toBeTruthy();
  expect(screen.queryByText(/#.*this week/)).toBeNull();
});
