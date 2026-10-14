import { getAuthMode, type AuthMode } from '@/config/environment';

export type TokenProvider = () => Promise<string | null>;

/** Owns the Authorization header. Credentials stay in memory, outside public configuration. */
export function createAuthService(mode: AuthMode) {
  let authorization: string | undefined;
  let tokenProvider: TokenProvider | undefined;
  let version = 0;

  function clear() {
    version += 1;
    authorization = undefined;
    tokenProvider = undefined;
  }

  return {
    clear,
    setToken(token: string | null) {
      if (mode !== 'clerk') throw new Error('Bearer tokens require Clerk auth mode.');
      clear();
      authorization = token ? `Bearer ${token}` : undefined;
    },
    setTokenProvider(provider: TokenProvider) {
      if (mode !== 'clerk') throw new Error('Token providers require Clerk auth mode.');
      clear();
      tokenProvider = provider;
    },
    setBasicCredentials(username: string, password: string) {
      if (mode !== 'basic') throw new Error('Basic credentials require Basic auth mode.');
      if (username.includes(':')) throw new Error('Basic auth usernames cannot contain a colon.');
      const bytes = new TextEncoder().encode(`${username}:${password}`);
      const encoded = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
      clear();
      authorization = `Basic ${encoded}`;
    },
    async getAuthorizationHeader(): Promise<string | undefined> {
      if (!tokenProvider) return authorization;
      const currentVersion = version;
      const token = await tokenProvider();
      // A token that resolves after logout must not be attached to a request.
      if (currentVersion !== version) throw new Error('Authentication changed. Try again.');
      return token ? `Bearer ${token}` : undefined;
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
export const authService = createAuthService(getAuthMode());
