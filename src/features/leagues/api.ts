import { apiClient } from '@/services/apiClient';
import {
  createSchema,
  createdLeagueSchema,
  invitationSchema,
  leagueDetailSchema,
  leagueListSchema,
  nameSchema,
  previewSchema,
  pendingResultsSchema,
  standingsSchema,
} from './schemas';

export const leaguesApi = {
  list: (signal?: AbortSignal) =>
    apiClient.get('/api/v1/leagues', { schema: leagueListSchema, signal }),
  detail: (id: number, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/leagues/${id}`, { schema: leagueDetailSchema, signal }),
  standings: (id: number, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/leagues/${id}/standings`, { schema: standingsSchema, signal }),
  pendingResults: (id: number, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/leagues/${id}/results/pending`, {
      schema: pendingResultsSchema,
      signal,
    }),
  acknowledge: (leagueId: number, resultId: number) =>
    apiClient.post(`/api/v1/leagues/${leagueId}/results/${resultId}/acknowledge`),
  create: (name: string, timezone: string) =>
    apiClient.post('/api/v1/leagues', createSchema.parse({ name, timezone }), {
      schema: createdLeagueSchema,
    }),
  rename: (id: number, name: string) =>
    apiClient.patch(
      `/api/v1/leagues/${id}`,
      { name: nameSchema.parse(name) },
      { schema: leagueDetailSchema },
    ),
  invite: (id: number) =>
    apiClient.post(`/api/v1/leagues/${id}/invitations`, undefined, { schema: invitationSchema }),
  preview: (token: string) =>
    apiClient.get(`/api/v1/league-invitations/${encodeURIComponent(token)}`, {
      schema: previewSchema,
    }),
  accept: (token: string) =>
    apiClient.post(`/api/v1/league-invitations/${encodeURIComponent(token)}/accept`, undefined, {
      schema: leagueDetailSchema,
    }),
};
