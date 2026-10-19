import { getApiBaseUrl } from '@/config/environment';
import { authService, type AuthService } from '@/services/authService';

export class ApiError extends Error {
  readonly status: number;
  readonly authScheme: string | undefined;

  constructor(status: number, authScheme?: string) {
    super(`API request failed (${status}).`);
    this.name = 'ApiError';
    this.status = status;
    this.authScheme = authScheme;
  }
}

type RequestOptions<T> = Omit<RequestInit, 'body' | 'method'> & {
  schema?: { parse: (value: unknown) => T };
};

export function createApiClient(
  baseUrl: string | undefined,
  auth: Pick<AuthService, 'getAuthorizationHeader'> = authService,
) {
  /** Pass a schema for runtime validation and inferred response types. */
  async function request<T>(
    path: string,
    method: string,
    body?: unknown,
    options: RequestOptions<T> = {},
  ): Promise<T> {
    if (!baseUrl) throw new Error('Set EXPO_PUBLIC_API_URL before making API requests.');
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
      throw new Error('API requests require a local path starting with /.');
    }
    const { schema, ...requestOptions } = options;
    const headers = new Headers(requestOptions.headers);
    headers.set('Accept', 'application/json');
    const authorization = await auth.getAuthorizationHeader();
    if (authorization) headers.set('Authorization', authorization);
    else headers.delete('Authorization');
    if (body !== undefined) headers.set('Content-Type', 'application/json');

    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 15000);
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
        ...requestOptions,
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'error',
      });
      if (!response.ok) {
        throw new ApiError(response.status, response.headers?.get('WWW-Authenticate') ?? undefined);
      }
      const data: unknown = response.status === 204 ? undefined : await response.json();
      return schema ? schema.parse(data) : (data as T);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
    }
  }

  return {
    get: <T = unknown>(path: string, options?: RequestOptions<T>) =>
      request<T>(path, 'GET', undefined, options),
    post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions<T>) =>
      request<T>(path, 'POST', body, options),
    put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions<T>) =>
      request<T>(path, 'PUT', body, options),
    patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions<T>) =>
      request<T>(path, 'PATCH', body, options),
    delete: <T = void>(path: string, options?: RequestOptions<T>) =>
      request<T>(path, 'DELETE', undefined, options),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
export const apiClient = createApiClient(getApiBaseUrl());
