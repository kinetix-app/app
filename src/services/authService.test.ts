import { createAuthService } from './authService';

test('Basic credentials produce the API header and clear on sign-out', async () => {
  const auth = createAuthService('basic');
  expect(await auth.getAuthorizationHeader()).toBeUndefined();
  auth.setBasicCredentials('alice@example.test', 'local-password');
  expect(await auth.getAuthorizationHeader()).toBe(
    'Basic YWxpY2VAZXhhbXBsZS50ZXN0OmxvY2FsLXBhc3N3b3Jk',
  );
  auth.clear();
  expect(await auth.getAuthorizationHeader()).toBeUndefined();
});

test('Basic credentials preserve UTF-8 passwords and colons', async () => {
  const auth = createAuthService('basic');
  auth.setBasicCredentials('alice', 'päss:word');
  expect(await auth.getAuthorizationHeader()).toBe('Basic YWxpY2U6cMOkc3M6d29yZA==');
});

test('authentication modes do not accept the other credential type', () => {
  expect(() => createAuthService('clerk').setBasicCredentials('alice', 'password')).toThrow(
    'require Basic auth mode',
  );
  expect(() => createAuthService('basic').setToken('token')).toThrow('require Clerk auth mode');
});

test('Clerk requests obtain fresh SDK tokens and logout removes the provider', async () => {
  const auth = createAuthService('clerk');
  const getToken = jest.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('renewed');
  auth.setTokenProvider(getToken);
  expect(await auth.getAuthorizationHeader()).toBe('Bearer first');
  expect(await auth.getAuthorizationHeader()).toBe('Bearer renewed');
  auth.clear();
  expect(await auth.getAuthorizationHeader()).toBeUndefined();
  expect(getToken).toHaveBeenCalledTimes(2);
});

test('a token arriving after logout cannot authorize a request', async () => {
  const auth = createAuthService('clerk');
  let finish!: (token: string) => void;
  auth.setTokenProvider(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const header = auth.getAuthorizationHeader();
  auth.clear();
  finish('old-session-token');
  await expect(header).rejects.toThrow('Authentication changed');
});
