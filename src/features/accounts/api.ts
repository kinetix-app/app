import { apiClient, type ApiClient } from '@/services/apiClient';

import {
  objectiveResponseSchema,
  objectiveSchema,
  type Objective,
  accountSchema,
  profilePatchSchema,
  type Account,
  type ProfilePatch,
} from './schemas';

export type { Account, ProfilePatch } from './schemas';

export function parseAccount(value: unknown) {
  return accountSchema.parse(value);
}

export function getAccount(client: ApiClient = apiClient, signal?: AbortSignal): Promise<Account> {
  return client.get('/api/v1/auth/me', { schema: accountSchema, signal });
}

export function updateProfile(
  client: ApiClient,
  patch: ProfilePatch,
  signal?: AbortSignal,
): Promise<Account> {
  return client.patch('/api/v1/me/profile', profilePatchSchema.parse(patch), {
    schema: accountSchema,
    signal,
  });
}

export function getObjective(signal?: AbortSignal) {
  return apiClient.get('/api/v1/me/objective', { schema: objectiveResponseSchema, signal });
}
export function setObjective(objective: Objective) {
  return apiClient.put(
    '/api/v1/me/objective',
    { objective: objectiveSchema.parse(objective) },
    { schema: objectiveResponseSchema },
  );
}
