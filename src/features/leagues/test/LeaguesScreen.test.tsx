import React from 'react';
import { Share, Text as MockText } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/services/apiClient';
import { leaguesApi } from '../api';
import { leagueDetailSchema } from '../schemas';
import { LeaguesScreen } from '../components/LeaguesScreen';

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `kinetix:///${path}`,
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('../api', () => ({
  leaguesApi: {
    list: jest.fn(),
    detail: jest.fn(),
    timezones: jest.fn(),
    createConfiguration: jest.fn(),
    saveConfiguration: jest.fn(),
    invite: jest.fn(),
    preview: jest.fn(),
    accept: jest.fn(),
    changeRole: jest.fn(),
  },
}));
jest.mock('../components/LeagueResults', () => ({ LeagueResults: () => null }));
jest.mock('../components/LeagueStandings', () => ({
  LeagueStandings: ({ header }: { header: React.ReactNode }) => (
    <>
      {header}
      <MockText>Standings content</MockText>
    </>
  ),
}));
const clients: QueryClient[] = [];
function setup(role: 'admin' | 'member', position: number | null = 2, memberCount = 2) {
  const league = leagueDetailSchema.parse({
    id: 9,
    creator_id: 1,
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
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <LeaguesScreen accountId={role === 'admin' ? 1 : 2} />
    </QueryClientProvider>,
  );
  return league;
}
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  jest.restoreAllMocks();
  jest.resetAllMocks();
});

test('league identity opens information with admin configuration and back returns to standings', async () => {
  setup('admin');
  fireEvent.press(await screen.findByRole('button', { name: 'Early birds' }));
  expect(await screen.findByRole('header', { name: 'Early birds' })).toBeTruthy();
  expect(screen.queryByRole('header', { name: 'League' })).toBeNull();
  expect(await screen.findByText('Standings content')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Edit league' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'View league information for Early birds' }));
  expect(screen.getByRole('header', { name: 'About' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Choose league picture' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Edit league' }));
  expect(screen.getByRole('button', { name: 'Choose league picture' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  expect(screen.getByLabelText('League name').props.value).toBe('Early birds');
  fireEvent.press(screen.getByRole('button', { name: 'Cancel editing' }));
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
  expect(screen.queryByRole('button', { name: 'Edit league' })).toBeNull();
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

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const findButton = (name: string | RegExp) => screen.findByRole('button', { name });

async function openInformation() {
  fireEvent.press(await findButton('Early birds'));
  await screen.findByText('Standings content');
  fireEvent.press(button('View league information for Early birds'));
}

test('validates a league name and creates the league with the selected timezone', async () => {
  const league = setup('admin');
  jest.mocked(leaguesApi.timezones).mockRejectedValueOnce(new Error('Offline'));
  jest.mocked(leaguesApi.timezones).mockResolvedValue(['America/New_York', 'Europe/Madrid']);
  jest.mocked(leaguesApi.createConfiguration).mockResolvedValue({
    ...league,
    timezone: 'America/New_York',
  });
  fireEvent.press(await findButton('Create league'));
  fireEvent.press(button('Create league'));
  expect(await screen.findByText('Enter a league name.')).toBeVisible();
  expect(leaguesApi.createConfiguration).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('League name'), 'Early birds');
  fireEvent.changeText(screen.getByLabelText('League description'), '  Start strong  ');
  fireEvent.press(button(/^Timezone:/));
  fireEvent.press(await findButton('Retry timezones'));
  await findButton('America/New_York');
  fireEvent.changeText(screen.getByLabelText('Search timezones'), 'nowhere');
  expect(await screen.findByText('No matching timezones.')).toBeVisible();
  fireEvent.changeText(screen.getByLabelText('Search timezones'), 'new york');
  fireEvent.press(await findButton('America/New_York'));
  expect(button('Timezone: America/New_York')).toBeVisible();
  fireEvent.press(button('Create league'));
  expect(await screen.findByText('Standings content')).toBeVisible();
  const form = jest.mocked(leaguesApi.createConfiguration).mock.calls[0][0];
  expect(form.get('data')).toBe(
    JSON.stringify({
      name: 'Early birds',
      timezone: 'America/New_York',
      description: 'Start strong',
    }),
  );
});

test('retains configuration edits after a rejected save and applies the retry', async () => {
  const league = setup('admin');
  const updated = { ...league, name: 'Morning club', description: 'Early sessions' };
  jest.mocked(leaguesApi.saveConfiguration).mockRejectedValueOnce(new ApiError(403));
  jest.mocked(leaguesApi.saveConfiguration).mockImplementation(async () => {
    jest.mocked(leaguesApi.detail).mockResolvedValue(updated);
    return updated;
  });
  await openInformation();
  fireEvent.press(button('Edit league'));
  fireEvent.changeText(screen.getByLabelText('League name'), '');
  fireEvent.press(button('Save'));
  expect(await screen.findByText('Enter a league name.')).toBeVisible();
  fireEvent.changeText(screen.getByLabelText('League name'), 'Morning club');
  fireEvent.changeText(screen.getByLabelText('League description'), '  Early sessions  ');
  fireEvent.press(button('Save'));
  expect(await screen.findByText('Only a league admin can do that.')).toBeVisible();
  expect(screen.getByLabelText('League name')).toHaveDisplayValue('Morning club');
  fireEvent.press(button('Save'));
  expect(await screen.findByText('Early sessions')).toBeVisible();
  const [id, form] = jest.mocked(leaguesApi.saveConfiguration).mock.calls[1];
  expect(id).toBe(9);
  expect(JSON.parse(String(form.get('data')))).toEqual({
    name: 'Morning club',
    description: 'Early sessions',
    remove_picture: false,
  });
});

test('retries a role change and displays the updated member permissions', async () => {
  const league = setup('admin');
  const updated = {
    ...league,
    members: league.members.map((member) =>
      member.user_id === 2 ? { ...member, role: 'admin' as const } : member,
    ),
  };
  jest.mocked(leaguesApi.changeRole).mockRejectedValueOnce(new Error('Offline'));
  jest.mocked(leaguesApi.changeRole).mockImplementation(async () => {
    jest.mocked(leaguesApi.detail).mockResolvedValue(updated);
    return updated;
  });
  await openInformation();
  expect(screen.queryByRole('button', { name: 'Change role for Alex' })).toBeNull();
  fireEvent.press(button('Change role for Sam'));
  fireEvent.press(button('Make admin'));
  expect(await screen.findByRole('alert')).toHaveTextContent(/could not/i);
  fireEvent.press(button('Make admin'));
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: 'Make admin' })).toBeNull();
    expect(button('Change role for Sam').props.accessibilityHint).toBe('Current role: Admin');
  });
  expect(leaguesApi.changeRole).toHaveBeenLastCalledWith(9, 2, 'admin');
  fireEvent.press(button('Change role for Sam'));
  expect(button('Make member')).toBeVisible();
  fireEvent.press(button('Cancel'));
  expect(leaguesApi.changeRole).toHaveBeenCalledTimes(2);
});

const invitation = {
  league_id: 9,
  name: 'Early birds',
  already_member: false,
  expires_at: '2026-11-20T12:00:00Z',
  created_at: '2026-11-17T10:00:00Z',
  timezone: 'Europe/Madrid',
  member_count: 2,
  description: 'Train before work',
  has_picture: false,
};

async function previewInvitation() {
  fireEvent.press(await findButton('Join a league'));
  fireEvent.press(button('Preview invitation'));
  expect(await screen.findByText('Enter an invitation link or token.')).toBeVisible();
  fireEvent.changeText(
    screen.getByLabelText('Invitation link or token'),
    'https://example.test/league-invitation/team-token',
  );
  fireEvent.press(button('Preview invitation'));
}

test('retries a temporary invitation error, previews the league and joins it', async () => {
  const league = setup('member');
  jest.mocked(leaguesApi.preview).mockRejectedValueOnce(new Error('Offline'));
  jest.mocked(leaguesApi.preview).mockResolvedValue(invitation);
  jest.mocked(leaguesApi.accept).mockResolvedValue(league);
  await previewInvitation();
  expect(await screen.findByText('Something went wrong. Please try again.')).toBeVisible();
  fireEvent.press(button('Retry invitation'));
  expect(await screen.findByText('Train before work')).toBeVisible();
  fireEvent.press(button('Join league'));
  expect(await screen.findByText('Standings content')).toBeVisible();
  expect(leaguesApi.preview).toHaveBeenLastCalledWith('team-token', expect.anything());
  expect(leaguesApi.accept).toHaveBeenCalledWith('team-token');
});

test('shows an expired invitation without a retry or join action', async () => {
  setup('member');
  jest.mocked(leaguesApi.preview).mockRejectedValue(new ApiError(410));
  await previewInvitation();
  expect(await screen.findByText('This invitation has expired.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Retry invitation' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Join league' })).toBeNull();
  fireEvent.press(button('Close invitation'));
  expect(await findButton('Join a league')).toBeVisible();
});

test('opens the standings from an invitation for an existing member without accepting again', async () => {
  setup('member');
  jest.mocked(leaguesApi.preview).mockResolvedValue({ ...invitation, already_member: true });
  await previewInvitation();
  fireEvent.press(await findButton('Open league'));
  expect(await screen.findByText('Standings content')).toBeVisible();
  expect(leaguesApi.accept).not.toHaveBeenCalled();
});

test('generates a shareable invitation and recovers when copying fails', async () => {
  setup('admin');
  jest.mocked(leaguesApi.invite).mockResolvedValue({
    token: 'signed-token',
    expires_at: invitation.expires_at,
  });
  jest.mocked(Clipboard.setStringAsync).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const share = jest.spyOn(Share, 'share').mockRejectedValueOnce(new Error('Unable to share'));
  await openInformation();
  fireEvent.press(button('Generate invitation'));
  fireEvent.press(await findButton('Copy invitation link'));
  expect(await screen.findByRole('alert')).toHaveTextContent(/could not copy/i);
  fireEvent.press(button('Copy invitation link'));
  expect(await screen.findByText('Link copied', { includeHiddenElements: true })).toBeOnTheScreen();
  const link = jest.mocked(Clipboard.setStringAsync).mock.calls[1][0];
  expect(link).toContain('/league-invitation/signed-token');
  fireEvent.press(button('Share invitation'));
  expect(await screen.findByRole('alert')).toHaveTextContent(/could not share/i);
  expect(share).toHaveBeenCalledWith({ message: link });
  expect(leaguesApi.invite).toHaveBeenCalledWith(9);
  fireEvent.press(button('Close invitation link'));
  expect(button('Generate invitation')).toBeVisible();
});
