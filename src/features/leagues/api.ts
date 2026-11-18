import { apiClient } from '@/services/apiClient';
import {
  createdLeagueSchema,
  invitationSchema,
  leagueDetailSchema,
  leaguePicturePathSchema,
  memberPicturePathSchema,
  leagueListSchema,
  timezonesSchema,
  previewSchema,
  pendingResultsSchema,
  roundsSchema,
  contributionsPageSchema,
  standingsPageSchema,
  scoreHistoryPageSchema,
} from './schemas';

function standingsQuery(roundId: number | null, offset: number) {
  const query = `offset=${offset}`;
  return roundId === null ? query : `${query}&round_id=${roundId}`;
}

export const leaguesApi = {
  list: (signal?: AbortSignal) =>
    apiClient.get('/api/v1/leagues', { schema: leagueListSchema, signal }),
  detail: (id: number, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/leagues/${id}`, { schema: leagueDetailSchema, signal }),
  picture: (path: string, signal?: AbortSignal) => {
    const result = leaguePicturePathSchema.or(memberPicturePathSchema).parse(path);
    return apiClient.getBlob(result, { signal });
  },
  rounds: (id: number, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/leagues/${id}/standings/rounds`, { schema: roundsSchema, signal }),
  standingsPage: (id: number, roundId: number | null, offset: number, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/leagues/${id}/standings/page?${standingsQuery(roundId, offset)}`, {
      schema: standingsPageSchema,
      signal,
    }),
  contributions: (id: number, roundId: number | null, offset: number, signal?: AbortSignal) =>
    apiClient.get(
      `/api/v1/leagues/${id}/standings/contributions?${standingsQuery(roundId, offset)}`,
      {
        schema: contributionsPageSchema,
        signal,
      },
    ),
  changeRole: (leagueId: number, memberId: number, role: 'admin' | 'member') =>
    apiClient.patch(
      `/api/v1/leagues/${leagueId}/members/${memberId}/role`,
      { role },
      { schema: leagueDetailSchema },
    ),
  scoreHistory: (
    leagueId: number,
    memberId: number,
    before: string | null,
    signal?: AbortSignal,
  ) => {
    const query = before ? `?before=${before}` : '';
    return apiClient.get(`/api/v1/leagues/${leagueId}/members/${memberId}/score-history${query}`, {
      schema: scoreHistoryPageSchema,
      signal,
    });
  },
  pendingResults: (id: number, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/leagues/${id}/results/pending`, {
      schema: pendingResultsSchema,
      signal,
    }),
  acknowledge: (leagueId: number, resultId: number) =>
    apiClient.post(`/api/v1/leagues/${leagueId}/results/${resultId}/acknowledge`),
  timezones: (signal?: AbortSignal) =>
    apiClient.get('/api/v1/leagues/timezones', { schema: timezonesSchema, signal }),
  createConfiguration: (form: FormData) =>
    apiClient.postMultipart('/api/v1/leagues/configuration', form, { schema: createdLeagueSchema }),
  saveConfiguration: (id: number, form: FormData) =>
    apiClient.postMultipart(`/api/v1/leagues/${id}/configuration`, form, {
      schema: leagueDetailSchema,
    }),
  invite: (id: number) =>
    apiClient.post(`/api/v1/leagues/${id}/invitations`, undefined, { schema: invitationSchema }),
  invitationPicture: (token: string, signal?: AbortSignal) =>
    apiClient.getBlob(`/api/v1/league-invitations/${encodeURIComponent(token)}/picture`, {
      signal,
    }),
  preview: (token: string, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/league-invitations/${encodeURIComponent(token)}`, {
      schema: previewSchema,
      signal,
    }),
  accept: (token: string) =>
    apiClient.post(`/api/v1/league-invitations/${encodeURIComponent(token)}/accept`, undefined, {
      schema: leagueDetailSchema,
    }),
};
