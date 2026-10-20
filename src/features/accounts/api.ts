import { apiClient, type ApiClient } from '@/services/apiClient';

import { accountSchema, profilePatchSchema, type Account, type ProfilePatch } from './schemas';

export type { Account, ProfilePatch } from './schemas';

export function parseAccount(value: unknown) {
  return accountSchema.parse(value);
}

export function getAccount(client: ApiClient = apiClient, signal?: AbortSignal): Promise<Account> {
  return client.get('/api/v1/me', { schema: accountSchema, signal });
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
