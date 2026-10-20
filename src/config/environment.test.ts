import { resolveApiBaseUrl, resolveAuthMode, resolveClerkPublishableKey } from './environment';

describe('public API URL configuration', () => {
  test.each([undefined, '', '   '])('allows an unset URL for the standalone starter', (value) => {
    expect(resolveApiBaseUrl(value)).toBeUndefined();
  });

  test('keeps an API path and removes whitespace and the final slash', () => {
    expect(resolveApiBaseUrl(' https://example.com/api/v1/ ')).toBe('https://example.com/api/v1');
  });

  test('allows an HTTP development backend on the Android emulator host bridge', () => {
    expect(resolveApiBaseUrl('http://10.0.2.2:8000')).toBe('http://10.0.2.2:8000');
  });

  test.each(['/api', 'not a url'])('rejects a non-absolute address: %s', (value) => {
    expect(() => resolveApiBaseUrl(value)).toThrow('absolute HTTP or HTTPS URL');
  });

  test('rejects unsupported transport protocols', () => {
    expect(() => resolveApiBaseUrl('ftp://example.com')).toThrow('must use HTTP or HTTPS');
  });

  test.each([
    'https://user:pass@example.com',
    'https://example.com?token=example',
    'https://example.com#example',
  ])('rejects credential or navigation data in a base URL: %s', (value) => {
    expect(() => resolveApiBaseUrl(value)).toThrow(
      'must not contain credentials, query parameters or fragments',
    );
  });
});

describe('public Clerk configuration', () => {
  test.each([undefined, '', '   '])('allows an unconfigured instance: %s', (value) => {
    expect(resolveClerkPublishableKey(value)).toBeUndefined();
  });

  test.each(['pk_test_aW5zdGFuY2UuY2xlcmsuYWNjb3VudHMuZGV2JA==', 'pk_live_bGl2ZSQ='])(
    'accepts public keys for separate instances',
    (value) => expect(resolveClerkPublishableKey(` ${value} `)).toBe(value),
  );

  test.each(['sk_test_do-not-embed', 'not-a-key', 'pk_test_'])(
    'rejects invalid or secret keys without echoing their value',
    (value) => {
      expect(() => resolveClerkPublishableKey(value)).toThrow('Clerk publishable key');
      try {
        resolveClerkPublishableKey(value);
      } catch (error) {
        expect(String(error)).not.toContain(value);
      }
    },
  );
});

describe('authentication configuration', () => {
  test('release Clerk configuration requires a live key', () => {
    expect(() => resolveClerkPublishableKey('pk_test_aGVsbG8', false)).toThrow('production');
    expect(resolveClerkPublishableKey('pk_live_aGVsbG8', false)).toBe('pk_live_aGVsbG8');
  });
  test.each([undefined, '', '   '])('defaults by build environment: %s', (value) => {
    expect(resolveAuthMode(value, true)).toBe('basic');
    expect(resolveAuthMode(value, false)).toBe('clerk');
  });

  test('allows Clerk verification in development', () => {
    expect(resolveAuthMode('clerk', true)).toBe('clerk');
  });

  test('rejects Basic in production', () => {
    expect(() => resolveAuthMode('basic', false)).toThrow('only available in development');
  });

  test('rejects obsolete mode names', () => {
    expect(() => resolveAuthMode('dev_basic', true)).toThrow('must be basic or clerk');
  });
});
