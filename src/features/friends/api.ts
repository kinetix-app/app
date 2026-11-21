import { apiClient } from '@/services/apiClient';
import {
  friendPageSchema,
  friendRequestsSchema,
  personPageSchema,
  personProfileSchema,
  relationshipResponseSchema,
} from './schemas';

export const friendsApi = {
  friends: (offset: number, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/friends?limit=50&offset=${offset}`, {
      schema: friendPageSchema,
      signal,
    }),
  requests: (signal?: AbortSignal) =>
    apiClient.get('/api/v1/friends/requests', { schema: friendRequestsSchema, signal }),
  search: (query: string, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/people?limit=20&q=${encodeURIComponent(query.trim())}`, {
      schema: personPageSchema,
      signal,
    }),
  picture: (id: number, signal?: AbortSignal) =>
    apiClient.getBlob(`/api/v1/people/${id}/picture`, { signal }),
  person: (id: number, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/people/${id}`, { schema: personProfileSchema, signal }),
  request: (userId: number) =>
    apiClient.post(
      '/api/v1/friends/requests',
      { user_id: userId },
      { schema: relationshipResponseSchema },
    ),
  accept: (userId: number) =>
    apiClient.post(`/api/v1/friends/requests/${userId}/accept`, undefined, {
      schema: relationshipResponseSchema,
    }),
  /** Unfriend, decline or cancel: the backend treats them as one idempotent removal. */
  remove: (userId: number) => apiClient.delete(`/api/v1/friends/${userId}`),
};

export const friendsKey = (accountId: number) => ['friends', accountId] as const;
export const requestsKey = (accountId: number) => ['friends', accountId, 'requests'] as const;
