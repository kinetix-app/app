import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { getAccount, type Account } from '@/features/accounts/api';
import { authService } from '@/services/authService';

import { ClerkSignInScreen } from '../components/ClerkSignInScreen';

const mockGetToken = jest.fn().mockResolvedValue('session-token');
const mockSignOut = jest.fn();
const mockSso = jest.fn();
const mockAuth = {
  isLoaded: true,
  isSignedIn: false,
  sessionId: 'sess_one',
  getToken: mockGetToken,
};
const mockSignIn = {
  status: 'complete',
  emailCode: { sendCode: jest.fn(), verifyCode: jest.fn() },
  finalize: jest.fn(),
};
const mockSignUp = {
  status: 'complete',
  create: jest.fn(),
  verifications: { sendEmailCode: jest.fn(), verifyEmailCode: jest.fn() },
  finalize: jest.fn(),
};
jest.mock('@clerk/expo', () => ({
  useAuth: () => mockAuth,
  useClerk: () => ({ signOut: mockSignOut }),
  useSignIn: () => ({ signIn: mockSignIn }),
  useSignUp: () => ({ signUp: mockSignUp }),
  useSSO: () => ({ startSSOFlow: mockSso }),
}));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'kinetix://sso-callback' }));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('@/features/accounts/api', () => ({ getAccount: jest.fn() }));
jest.mock('@/features/home', () => ({
  HomeScreen: ({ accountId, onSignOut }: { accountId: number; onSignOut: () => void }) => {
    const { Text, Pressable, View } = jest.requireActual('react-native');
    return (
      <View>
        <Text>Home for account {accountId}</Text>
        <Pressable onPress={onSignOut}>
          <Text>Sign out</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock('@/services/authService', () => ({
  authService: { clear: jest.fn(), setTokenProvider: jest.fn() },
}));
const account: Account = {
  id: 1,
  status: 'active' as const,
  created_at: '2026-10-14T12:00:00Z',
  profile: { display_name: 'Alice', timezone: null, updated_at: '2026-10-14T12:00:00Z' },
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockAuth, { isLoaded: true, isSignedIn: false, sessionId: 'sess_one' });
  mockSignIn.status = 'complete';
  for (const fn of [
    mockSignIn.emailCode.sendCode,
    mockSignIn.emailCode.verifyCode,
    mockSignIn.finalize,
    mockSignUp.create,
    mockSignUp.verifications.sendEmailCode,
    mockSignUp.verifications.verifyEmailCode,
    mockSignUp.finalize,
  ])
    fn.mockResolvedValue({ error: null });
  mockSignOut.mockResolvedValue(undefined);
  jest.mocked(getAccount).mockResolvedValue(account);
});

async function requestCode() {
  fireEvent.changeText(screen.getByLabelText('Email'), 'alice@example.test');
  fireEvent.press(screen.getByText('Send email code'));
  await screen.findByLabelText('Email verification code');
}

test('waits for SDK session restoration before showing sign-in or making account requests', () => {
  mockAuth.isLoaded = false;
  render(<ClerkSignInScreen />);
  expect(screen.getByLabelText('Restoring session')).toBeTruthy();
  expect(screen.queryByText('Send email code')).toBeNull();
  expect(getAccount).not.toHaveBeenCalled();
});

test('sends and verifies email OTP and finalizes the SDK session', async () => {
  render(<ClerkSignInScreen />);
  await requestCode();
  expect(mockSignIn.emailCode.sendCode).toHaveBeenCalledWith({
    emailAddress: 'alice@example.test',
  });
  fireEvent.changeText(screen.getByLabelText('Email verification code'), '123456');
  fireEvent.press(screen.getByText('Verify code'));
  await waitFor(() => expect(mockSignIn.finalize).toHaveBeenCalledTimes(1));
  expect(mockSignIn.emailCode.verifyCode).toHaveBeenCalledWith({ code: '123456' });
});

test('expired codes stay on the verification screen and can be resent after cooldown', async () => {
  jest.useFakeTimers();
  try {
    mockSignIn.emailCode.verifyCode.mockResolvedValue({ error: new Error('expired') });
    render(<ClerkSignInScreen />);
    await requestCode();
    fireEvent.changeText(screen.getByLabelText('Email verification code'), '000000');
    fireEvent.press(screen.getByText('Verify code'));
    await screen.findByText(
      'The code was not accepted or has expired. Try again or request a new code.',
    );
    expect(mockSignIn.finalize).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });
    fireEvent.press(screen.getByText('Resend code'));
    await waitFor(() => expect(mockSignIn.emailCode.sendCode).toHaveBeenCalledTimes(2));
  } finally {
    jest.useRealTimers();
  }
});

test('new accounts use the SDK email sign-up and verification methods', async () => {
  render(<ClerkSignInScreen />);
  fireEvent.press(screen.getByText('New here? Create account'));
  await requestCode();
  fireEvent.changeText(screen.getByLabelText('Email verification code'), '123456');
  fireEvent.press(screen.getByText('Verify code'));
  await waitFor(() => expect(mockSignUp.finalize).toHaveBeenCalledTimes(1));
  expect(mockSignUp.create).toHaveBeenCalledWith({ emailAddress: 'alice@example.test' });
  expect(mockSignIn.emailCode.sendCode).not.toHaveBeenCalled();
});

test.each(['Google', 'Apple'])('activates the SDK session returned by %s', async (provider) => {
  const setActive = jest.fn().mockResolvedValue(undefined);
  mockSso.mockResolvedValue({ createdSessionId: 'sess_social', setActive });
  render(<ClerkSignInScreen />);
  fireEvent.press(screen.getByLabelText(`Continue with ${provider}`));
  await waitFor(() => expect(setActive).toHaveBeenCalledWith({ session: 'sess_social' }));
  expect(mockSso).toHaveBeenCalledWith({
    strategy: `oauth_${provider.toLowerCase()}`,
    redirectUrl: 'kinetix://sso-callback',
  });
});

test('provider cancellation leaves a usable sign-in screen', async () => {
  mockSso.mockResolvedValue({ createdSessionId: null, authSessionResult: { type: 'cancel' } });
  render(<ClerkSignInScreen />);
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Continue with Google'));
  });
  expect(screen.queryByLabelText('Authenticating')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(getAccount).not.toHaveBeenCalled();
});

test('provider failure shows a retryable error', async () => {
  mockSso.mockRejectedValue(new Error('network'));
  render(<ClerkSignInScreen />);
  fireEvent.press(screen.getByLabelText('Continue with Apple'));
  await screen.findByText('Provider sign-in could not finish. Please try again.');
});

test('restored sessions connect to the account API and logout clears private state', async () => {
  mockAuth.isSignedIn = true;
  render(<ClerkSignInScreen />);
  await screen.findByText('Home for account 1');
  expect(authService.setTokenProvider).toHaveBeenCalledWith(mockGetToken);
  const signal = jest.mocked(getAccount).mock.calls[0][1];
  fireEvent.press(screen.getByText('Sign out'));
  await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
  expect(authService.clear).toHaveBeenCalled();
  expect(signal?.aborted).toBe(true);
  expect(screen.queryByText('Home for account 1')).toBeNull();
});

test('switching sessions cancels old account requests and never shows their late response', async () => {
  mockAuth.isSignedIn = true;
  let resolveOld!: (value: typeof account) => void;
  jest.mocked(getAccount).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  const view = render(<ClerkSignInScreen />);
  const oldSignal = jest.mocked(getAccount).mock.calls[0][1];
  jest
    .mocked(getAccount)
    .mockResolvedValue({ ...account, id: 2, profile: { ...account.profile, display_name: 'Bob' } });
  mockAuth.sessionId = 'sess_two';
  view.rerender(<ClerkSignInScreen />);
  await screen.findByText('Home for account 2');
  await act(async () => {
    resolveOld(account);
  });
  expect(oldSignal?.aborted).toBe(true);
  expect(screen.queryByText('Home for account 1')).toBeNull();
});
