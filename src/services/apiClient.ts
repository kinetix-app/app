export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Pass Clerk's ordinary getToken() here; never decode JWTs or persist bearer tokens here. */
export type GetSessionToken = () => Promise<string | null>;

type RequestOptions = {
  method?: 'GET' | 'PATCH';
  body?: unknown;
  signal?: AbortSignal;
};

export type ApiClient = {
  request: (path: string, options?: RequestOptions) => Promise<unknown>;
  dispose: () => void;
};

function abortError(): Error {
  const error = new Error('Request canceled.');
  error.name = 'AbortError';
  return error;
}

function checkAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError();
}

/** Create one client per Clerk session; dispose it before logout or account changes. */
export function createApiClient(
  baseUrl: string,
  getToken: GetSessionToken,
  timeoutMs = 15000,
): ApiClient {
  const url = new URL(baseUrl);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('The API base URL must be an HTTP(S) URL without credentials or query data.');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('The API timeout must be positive.');
  }
  const root = url.toString().replace(/\/$/, '');
  const requests = new Set<AbortController>();
  let disposed = false;

  return {
    dispose() {
      disposed = true;
      requests.forEach((controller) => controller.abort());
      requests.clear();
    },
    async request(path, { method = 'GET', body, signal } = {}) {
      // Accept only local API paths so callers cannot send session tokens to another origin.
      if (!/^\/api\/v1\/[a-z0-9/_-]+$/.test(path)) {
        throw new Error('Expected a path under /api/v1/.');
      }
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (disposed || signal?.aborted) controller.abort();
      checkAborted(controller.signal);
      signal?.addEventListener('abort', abort, { once: true });
      requests.add(controller);
      const timeout = setTimeout(abort, timeoutMs);
      let rejectCancellation: () => void = () => {};
      const canceled = new Promise<never>((_, reject) => {
        rejectCancellation = () => {
          reject(abortError());
        };
        controller.signal.addEventListener('abort', rejectCancellation, { once: true });
      });

      try {
        // Read a fresh token on each request so SDK renewal is respected.
        const token = await Promise.race([getToken(), canceled]);
        checkAborted(controller.signal);
        if (!token) throw new ApiError(401, 'Sign in to continue.');
        const response = await Promise.race([
          fetch(`${root}${path}`, {
            method,
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
              ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
            credentials: 'omit',
            redirect: 'error',
            cache: 'no-store',
          }),
          canceled,
        ]);
        checkAborted(controller.signal);
        if (!response.ok) {
          const message =
            response.status === 401
              ? 'Your session has expired. Sign in again.'
              : response.status === 403
                ? 'Account access denied.'
                : response.status === 422
                  ? 'Check your profile details and try again.'
                  : 'The request could not be completed. Try again.';
          throw new ApiError(response.status, message);
        }
        const data: unknown = await Promise.race([response.json(), canceled]);
        // Ignore a response that finished after logout or an account switch.
        checkAborted(controller.signal);
        return data;
      } finally {
        clearTimeout(timeout);
        controller.signal.removeEventListener('abort', rejectCancellation);
        signal?.removeEventListener('abort', abort);
        requests.delete(controller);
      }
    },
  };
}
