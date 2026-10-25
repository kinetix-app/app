import { ApiError, createApiClient } from './apiClient';
import { createAuthService } from './authService';

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('uses fresh Clerk tokens and preserves PATCH null versus omission', async () => {
  const auth = createAuthService('clerk');
  auth.setTokenProvider(jest.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('renewed'));
  const client = createApiClient('https://api.example/', auth);
  await client.get<{ ok: boolean }>('/api/v1/me');
  await client.patch('/api/v1/me/profile', { display_name: null });
  expect(fetchMock.mock.calls[0][0]).toBe('https://api.example/api/v1/me');
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer first');
  expect(fetchMock.mock.calls[1][1].headers.get('Authorization')).toBe('Bearer renewed');
  expect(fetchMock.mock.calls[1][1].body).toBe('{"display_name":null}');
});

test('clears the authorization header without recreating the API client', async () => {
  const auth = createAuthService('clerk');
  auth.setToken('token');
  const client = createApiClient('https://api.example', auth);
  await client.get('/api/v1/me');
  auth.clear();
  await client.get('/health/live');
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer token');
  expect(fetchMock.mock.calls[1][1].headers.has('Authorization')).toBe(false);
});

test.each(['https://attacker.example/api/v1/me', '//attacker.example', '/\\attacker.example'])(
  'requires a local request path: %s',
  async (path) => {
    const client = createApiClient('https://api.example');
    await expect(client.get(path)).rejects.toThrow('local path');
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

test('rejects a Clerk token that resolves after credentials have been cleared', async () => {
  let resolveToken: (token: string) => void = () => {};
  const auth = createAuthService('clerk');
  auth.setTokenProvider(
    () =>
      new Promise((resolve) => {
        resolveToken = resolve;
      }),
  );
  const client = createApiClient('https://api.example', auth);
  const pending = client.get('/api/v1/me');
  auth.clear();
  resolveToken('old-token');
  await expect(pending).rejects.toThrow('Authentication changed');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('forwards caller cancellation to the HTTP request', async () => {
  const controller = new AbortController();
  controller.abort();
  const client = createApiClient('https://api.example');
  await client.get('/health/live', { signal: controller.signal });
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
});

test('reports failed mutations once without retrying or exposing response contents', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 503 });
  const client = createApiClient('https://api.example');
  await expect(client.patch('/api/v1/me/profile', { display_name: 'Alice' })).rejects.toEqual(
    new ApiError(503),
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('multipart preserves FormData and lets fetch supply the boundary while retaining auth', async () => {
  const auth = createAuthService('clerk');
  auth.setToken('photo-token');
  const client = createApiClient('https://api.example', auth);
  const body = new FormData();
  body.append('file', 'sample');
  await client.postMultipart('/api/v1/me/profile/picture', body, {
    headers: { 'Content-Type': 'application/json' },
  });
  expect(fetchMock.mock.calls[0][1].body).toBe(body);
  expect(fetchMock.mock.calls[0][1].headers.has('Content-Type')).toBe(false);
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer photo-token');
});

test('private image bytes use the authenticated client and caller cancellation', async () => {
  const blob = new Blob(['image'], { type: 'image/jpeg' });
  const auth = createAuthService('clerk');
  auth.setToken('photo-token');
  const client = createApiClient('https://api.example', auth);
  fetchMock.mockResolvedValue({ ok: true, status: 200, blob: async () => blob });
  expect(await client.getBlob('/api/v1/me/profile/picture')).toBe(blob);
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer photo-token');
  expect(fetchMock.mock.calls[0][1].headers.get('Accept')).toBe('image/jpeg');
});
