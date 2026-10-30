import { render, screen, waitFor } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Platform } from 'react-native';

import { SsoCallbackScreen } from '../components/SsoCallbackScreen';

jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-router', () => ({
  Redirect: jest.fn(() => null),
  Link: jest.requireActual('react-native').Text,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));

const originalPlatform = Platform.OS;
const originalOpener = Object.getOwnPropertyDescriptor(window, 'opener');

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  Object.defineProperty(window, 'opener', { configurable: true, value: { closed: false } });
  jest.mocked(WebBrowser.maybeCompleteAuthSession).mockReturnValue({
    type: 'success',
    message: 'Attempting to complete auth',
  });
});

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  if (originalOpener) Object.defineProperty(window, 'opener', originalOpener);
  else Reflect.deleteProperty(window, 'opener');
});

test('completes the callback once without navigating away or disabling redirect checks', async () => {
  const { rerender } = render(<SsoCallbackScreen />);
  rerender(<SsoCallbackScreen />);
  await waitFor(() => expect(WebBrowser.maybeCompleteAuthSession).toHaveBeenCalledTimes(1));
  expect(WebBrowser.maybeCompleteAuthSession).toHaveBeenCalledWith();
  expect(Redirect).not.toHaveBeenCalled();
  expect(screen.queryByText('Return to sign-in')).toBeNull();
  expect(screen.getByText(/This window will close automatically/)).toBeTruthy();
});

test.each([null, { closed: true }])(
  'offers recovery without completing a direct or orphaned visit',
  async (opener) => {
    Object.defineProperty(window, 'opener', { configurable: true, value: opener });
    render(<SsoCallbackScreen />);
    expect(WebBrowser.maybeCompleteAuthSession).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Return to sign-in').props.href).toBe('/');
    expect(Redirect).not.toHaveBeenCalled();
  },
);

test.each(['failed', 'throws'])(
  'offers recovery without exposing SDK diagnostics when completion %s',
  async (failure) => {
    const diagnostic = 'private-callback-url';
    jest.mocked(WebBrowser.maybeCompleteAuthSession).mockImplementation(() => {
      if (failure === 'throws') throw new Error(diagnostic);
      return { type: 'failed', message: diagnostic };
    });
    render(<SsoCallbackScreen />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText(diagnostic)).toBeNull();
    expect(screen.getByText('Return to sign-in')).toBeTruthy();
    expect(Redirect).not.toHaveBeenCalled();
  },
);

test.each(['android', 'ios'])('preserves the native callback redirect on %s', (platform) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
  render(<SsoCallbackScreen />);
  expect(Redirect).toHaveBeenCalledWith(expect.objectContaining({ href: '/' }), undefined);
  expect(WebBrowser.maybeCompleteAuthSession).not.toHaveBeenCalled();
});
