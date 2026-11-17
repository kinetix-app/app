import { apiClient } from '@/services/apiClient';
import {
  createSchema,
  createdLeagueSchema,
  invitationSchema,
  leagueDetailSchema,
  leagueListSchema,
  nameSchema,
  previewSchema,
} from './schemas';

export const leaguesApi = {
  list: (signal?: AbortSignal) =>
    apiClient.get('/api/v1/leagues', { schema: leagueListSchema, signal }),
  detail: (id: number, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/leagues/${id}`, { schema: leagueDetailSchema, signal }),
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
