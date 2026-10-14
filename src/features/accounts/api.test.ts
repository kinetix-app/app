import { getAccount, parseAccount, updateProfile } from './api';

const account = {
  id: 'bf08d0a0-6ae6-4a7a-8d3f-8dbe890bd395',
  status: 'active',
  created_at: '2026-10-14T12:00:00Z',
  profile: {
    display_name: null,
    timezone: null,
    updated_at: '2026-10-14T12:00:00Z',
  },
};

test('accepts the private backend account contract', () => {
  expect(parseAccount(account)).toEqual(account);
});

test.each([
  null,
  {},
  { ...account, id: 'user_clerk-id-is-not-the-local-uuid' },
  { ...account, status: 'blocked' },
  { ...account, created_at: 'invalid' },
  { ...account, profile: { ...account.profile, timezone: 5 } },
])('rejects an invalid account response', (value) => {
  expect(() => parseAccount(value)).toThrow('invalid account');
});

test('uses the authenticated endpoints and preserves explicit clearing versus omitted fields', async () => {
  const client = { request: jest.fn().mockResolvedValue(account), dispose: jest.fn() };
  await getAccount(client);
  await updateProfile(client, { display_name: null });
  expect(client.request.mock.calls).toEqual([
    ['/api/v1/me', { signal: undefined }],
    ['/api/v1/me/profile', { method: 'PATCH', body: { display_name: null }, signal: undefined }],
  ]);
});
