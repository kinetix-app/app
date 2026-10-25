import { createApiClient } from '@/services/apiClient';

import { getAccount, parseAccount, updateProfile } from '../api';
import { accountSchema } from '../schemas';

import { incompleteAccount as account } from './fixtures';

test('accepts the private backend account contract', () => {
  expect(parseAccount(account)).toEqual(account);
});

test.each([
  null,
  {},
  { ...account, id: 'user_clerk-id-is-not-the-local-id' },
  { ...account, status: 'blocked' },
  { ...account, created_at: 'invalid' },
  { ...account, profile: { ...account.profile, timezone: 5 } },
])('rejects an invalid account response', (value) => {
  expect(() => parseAccount(value)).toThrow();
});

test('uses the authenticated endpoints and preserves explicit clearing versus omitted fields', async () => {
  const client = createApiClient('https://api.example');
  const get = jest.spyOn(client, 'get').mockResolvedValue(account);
  const patch = jest.spyOn(client, 'patch').mockResolvedValue(account);
  await getAccount(client);
  await updateProfile(client, { display_name: null });
  expect(get).toHaveBeenCalledWith('/api/v1/auth/me', { schema: accountSchema, signal: undefined });
  expect(patch).toHaveBeenCalledWith(
    '/api/v1/me/profile',
    { display_name: null },
    { schema: accountSchema, signal: undefined },
  );
});
