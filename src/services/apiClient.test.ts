import { ApiError, createApiClient } from './apiClient';

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
});

test('gets a renewed token for each request and preserves PATCH null versus omission', async () => {
  const getToken = jest.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('renewed');
  const client = createApiClient('https://api.example/', getToken);
  await client.request('/api/v1/me');
  await client.request('/api/v1/me/profile', { method: 'PATCH', body: { display_name: null } });
  expect(fetchMock.mock.calls[0][0]).toBe('https://api.example/api/v1/me');
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer first');
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer renewed');
  expect(fetchMock.mock.calls[1][1].body).toBe('{"display_name":null}');
});

test('does not send a request without a signed-in session', async () => {
  const client = createApiClient('https://api.example', async () => null);
  await expect(client.request('/api/v1/me')).rejects.toMatchObject({ status: 401 });
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each(['https://attacker.example/api/v1/me', '//attacker.example', '/api/v1/../other'])(
  'never sends credentials to an arbitrary URL: %s',
  async (path) => {
    const getToken = jest.fn();
    const client = createApiClient('https://api.example', getToken);
    await expect(client.request(path)).rejects.toThrow('Expected a path');
    expect(getToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

test('disposing a session cancels token acquisition and prevents stale requests', async () => {
  const getToken = jest.fn(() => new Promise<string | null>(() => {}));
  const client = createApiClient('https://api.example', getToken);
  const pending = client.request('/api/v1/me');
  client.dispose();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await expect(client.request('/api/v1/me')).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetchMock).not.toHaveBeenCalled();
});

test('caller cancellation prevents a late response being returned', async () => {
  const controller = new AbortController();
  fetchMock.mockImplementation(async () => {
    controller.abort();
    return { ok: true, json: async () => ({ private: true }) };
  });
  const client = createApiClient('https://api.example', async () => 'token');
  await expect(client.request('/api/v1/me', { signal: controller.signal })).rejects.toMatchObject({
    name: 'AbortError',
  });
});

test('timeouts cover token acquisition as well as the HTTP request', async () => {
  jest.useFakeTimers();
  const client = createApiClient('https://api.example', () => new Promise(() => {}), 100);
  const pending = expect(client.request('/api/v1/me')).rejects.toMatchObject({
    name: 'AbortError',
  });
  await jest.advanceTimersByTimeAsync(100);
  await pending;
  expect(fetchMock).not.toHaveBeenCalled();
});

test('reports a failed mutation once without returning server details or retrying', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 503 });
  const client = createApiClient('https://api.example', async () => 'private-token');
  await expect(
    client.request('/api/v1/me/profile', { method: 'PATCH', body: { display_name: 'Alice' } }),
  ).rejects.toEqual(new ApiError(503, 'The request could not be completed. Try again.'));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
