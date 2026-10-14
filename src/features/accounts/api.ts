import type { ApiClient } from '@/services/apiClient';

export type Account = {
  id: string;
  status: 'active';
  created_at: string;
  profile: {
    display_name: string | null;
    timezone: string | null;
    updated_at: string;
  };
};

export type ProfilePatch = {
  display_name?: string | null;
  timezone?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function parseAccount(value: unknown): Account {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id) ||
    value.status !== 'active' ||
    !isTimestamp(value.created_at) ||
    !isRecord(value.profile) ||
    !isNullableString(value.profile.display_name) ||
    !isNullableString(value.profile.timezone) ||
    !isTimestamp(value.profile.updated_at)
  ) {
    throw new Error('The API returned an invalid account.');
  }
  return {
    id: value.id,
    status: value.status,
    created_at: value.created_at,
    profile: {
      display_name: value.profile.display_name,
      timezone: value.profile.timezone,
      updated_at: value.profile.updated_at,
    },
  };
}

export async function getAccount(client: ApiClient, signal?: AbortSignal): Promise<Account> {
  return parseAccount(await client.request('/api/v1/me', { signal }));
}

export async function updateProfile(
  client: ApiClient,
  patch: ProfilePatch,
  signal?: AbortSignal,
): Promise<Account> {
  return parseAccount(
    await client.request('/api/v1/me/profile', { method: 'PATCH', body: patch, signal }),
  );
}
