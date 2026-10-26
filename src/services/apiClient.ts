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
type ResponseMode = 'json' | 'multipart' | 'blob';

function validateRequestPath(baseUrl: string | undefined, path: string) {
  if (!baseUrl) throw new Error('Set EXPO_PUBLIC_API_URL before making API requests.');
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    throw new Error('API requests require a local path starting with /.');
  }
  return baseUrl;
}

async function createRequestHeaders<T>(
  options: RequestOptions<T>,
  auth: Pick<AuthService, 'getAuthorizationHeader'>,
  body: unknown,
  mode: ResponseMode,
) {
  const headers = new Headers(options.headers);
  headers.set('Accept', mode === 'blob' ? 'image/jpeg' : 'application/json');
  const authorization = await auth.getAuthorizationHeader();
  if (authorization) headers.set('Authorization', authorization);
  else headers.delete('Authorization');
  if (body !== undefined && mode === 'json') headers.set('Content-Type', 'application/json');
  if (mode === 'multipart') headers.delete('Content-Type');
  return headers;
}

function serializeRequestBody(body: unknown, mode: ResponseMode): BodyInit | undefined {
  if (body === undefined) return undefined;
  if (mode === 'multipart') return body as FormData;
  return JSON.stringify(body);
}

async function readResponse<T>(
  response: Response,
  mode: ResponseMode,
  schema: RequestOptions<T>['schema'],
): Promise<T> {
  if (!response.ok) {
    throw new ApiError(response.status, response.headers?.get('WWW-Authenticate') ?? undefined);
  }
  let data: unknown;
  if (response.status !== 204) {
    if (mode === 'blob') data = await response.blob();
    else data = await response.json();
  }
  if (schema) return schema.parse(data);
  return data as T;
}

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
    mode: ResponseMode = 'json',
  ): Promise<T> {
    const resolvedBaseUrl = validateRequestPath(baseUrl, path);
    const { schema, ...requestOptions } = options;
    const headers = await createRequestHeaders(requestOptions, auth, body, mode);

    const controller = new AbortController();
    const abort = () => controller.abort();
    if (requestOptions.signal?.aborted) controller.abort();
    requestOptions.signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 15000);
    try {
      const response = await fetch(`${resolvedBaseUrl.replace(/\/$/, '')}${path}`, {
        ...requestOptions,
        method,
        headers,
        body: serializeRequestBody(body, mode),
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'error',
      });
      return await readResponse(response, mode, schema);
    } finally {
      clearTimeout(timeout);
      requestOptions.signal?.removeEventListener('abort', abort);
    }
  }

  return {
    postMultipart: <T = unknown>(path: string, body: FormData, options?: RequestOptions<T>) =>
      request<T>(path, 'POST', body, options, 'multipart'),
    getBlob: (path: string, options?: Omit<RequestOptions<Blob>, 'schema'>) =>
      request<Blob>(path, 'GET', undefined, options, 'blob'),
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
