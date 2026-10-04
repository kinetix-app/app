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
