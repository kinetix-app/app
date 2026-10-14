export function resolveApiBaseUrl(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  if (!candidate) return undefined;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL must be an absolute HTTP or HTTPS URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_API_URL must use HTTP or HTTPS.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'EXPO_PUBLIC_API_URL must not contain credentials, query parameters or fragments.',
    );
  }

  return url.toString().replace(/\/$/, '');
}

export function getApiBaseUrl(): string | undefined {
  return resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);
}

export function resolveClerkPublishableKey(value: string | undefined): string | undefined {
  const key = value?.trim();
  if (!key) return undefined;
  if (!/^pk_(test|live)_[A-Za-z0-9+/=_-]+$/.test(key)) {
    throw new Error('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY must be a Clerk publishable key.');
  }
  return key;
}

export function getClerkPublishableKey(): string | undefined {
  return resolveClerkPublishableKey(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY);
}
