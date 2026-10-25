import { completeAccount } from '@/features/accounts/test/fixtures';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { getAccount } from '@/features/accounts/api';
import { ApiError } from '@/services/apiClient';
import { authService } from '@/services/authService';

import { DevelopmentSignInScreen } from '../components/DevelopmentSignInScreen';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('@/config/environment', () => ({
  getApiBaseUrl: () => 'http://localhost:8000',
  getAuthMode: () => 'basic',
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

beforeEach(() => {
  jest.clearAllMocks();
  authService.clear();
});
function submit() {
  fireEvent.changeText(screen.getByLabelText('Email'), 'alice@example.test');
  fireEvent.changeText(screen.getByLabelText('Password'), 'local-password');
  fireEvent.press(screen.getByText('Sign in'));
}

test('sign-in waits for backend acceptance and logout clears credentials', async () => {
  jest.mocked(getAccount).mockResolvedValue(completeAccount);
  render(<DevelopmentSignInScreen />);
  submit();
  await screen.findByText('Home for account 1');
  expect(await authService.getAuthorizationHeader()).toBe(
    'Basic YWxpY2VAZXhhbXBsZS50ZXN0OmxvY2FsLXBhc3N3b3Jk',
  );
  fireEvent.press(screen.getByText('Sign out'));
  expect(await authService.getAuthorizationHeader()).toBeUndefined();
  expect(screen.queryByText('Home for account 1')).toBeNull();
});

test('wrong credentials leave the account signed out and discard the header', async () => {
  jest.mocked(getAccount).mockRejectedValue(new ApiError(401, 'Basic'));
  render(<DevelopmentSignInScreen />);
  submit();
  await screen.findByText(
    'The email or password was not accepted. Use an account configured on the backend.',
  );
  expect(await authService.getAuthorizationHeader()).toBeUndefined();
  expect(screen.queryByText('Home for account 1')).toBeNull();
});

test('leaving a pending sign-in aborts its API call and clears credentials', async () => {
  jest.mocked(getAccount).mockImplementation(() => new Promise(() => {}));
  const view = render(<DevelopmentSignInScreen />);
  submit();
  await waitFor(() => expect(getAccount).toHaveBeenCalledTimes(1));
  const signal = jest.mocked(getAccount).mock.calls[0][1];
  view.unmount();
  expect(signal?.aborted).toBe(true);
  expect(await authService.getAuthorizationHeader()).toBeUndefined();
});
