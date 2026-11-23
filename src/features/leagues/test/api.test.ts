import { apiClient } from '@/services/apiClient';
import { leaguesApi } from '../api';
import { contributionsPageSchema, scoreHistoryPageSchema, standingsPageSchema } from '../schemas';

afterEach(() => jest.restoreAllMocks());

test('keeps round filters, offsets and cancellation on the standings and history requests', async () => {
  const get = jest.spyOn(apiClient, 'get').mockResolvedValue({});
  const signal = new AbortController().signal;
  await leaguesApi.standingsPage(9, null, 20, signal);
  await leaguesApi.standingsPage(9, 2, 0, signal);
  await leaguesApi.contributions(9, 2, 20, signal);
  await leaguesApi.scoreHistory(9, 8, null, signal);
  await leaguesApi.scoreHistory(9, 8, '2026-11-17', signal);
  expect(get.mock.calls).toEqual([
    ['/api/v1/leagues/9/standings/page?offset=20', { signal, schema: standingsPageSchema }],
    [
      '/api/v1/leagues/9/standings/page?offset=0&round_id=2',
      { signal, schema: standingsPageSchema },
    ],
    [
      '/api/v1/leagues/9/standings/contributions?offset=20&round_id=2',
      { signal, schema: contributionsPageSchema },
    ],
    ['/api/v1/leagues/9/members/8/score-history', { signal, schema: scoreHistoryPageSchema }],
    [
      '/api/v1/leagues/9/members/8/score-history?before=2026-11-17',
      { signal, schema: scoreHistoryPageSchema },
    ],
  ]);
});

test('fetches only supported relative picture routes through the authenticated client', async () => {
  const blob = jest.spyOn(apiClient, 'getBlob').mockResolvedValue(new Blob());
  const signal = new AbortController().signal;
  await leaguesApi.picture('/api/v1/leagues/9/picture?v=2', signal);
  await leaguesApi.picture('/api/v1/leagues/9/members/8/picture', signal);
  expect(() => leaguesApi.picture('https://example.test/api/v1/leagues/9/picture')).toThrow();
  expect(blob.mock.calls).toEqual([
    ['/api/v1/leagues/9/picture?v=2', { signal }],
    ['/api/v1/leagues/9/members/8/picture', { signal }],
  ]);
});

test('encodes invitation tokens consistently for preview, picture and acceptance', async () => {
  const get = jest.spyOn(apiClient, 'get').mockResolvedValue({});
  const blob = jest.spyOn(apiClient, 'getBlob').mockResolvedValue(new Blob());
  const post = jest.spyOn(apiClient, 'post').mockResolvedValue({});
  const signal = new AbortController().signal;
  const path = '/api/v1/league-invitations/team%2Fjoin%3F';
  await leaguesApi.preview('team/join?', signal);
  await leaguesApi.invitationPicture('team/join?', signal);
  await leaguesApi.accept('team/join?');
  expect(get).toHaveBeenCalledWith(path, expect.objectContaining({ signal }));
  expect(blob).toHaveBeenCalledWith(path + '/picture', { signal });
  expect(post).toHaveBeenCalledWith(path + '/accept', undefined, expect.anything());
});
