import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { getProfilePicture } from '../api';
import { completeAccount } from './fixtures';

jest.mock('../api', () => ({ getProfilePicture: jest.fn() }));

test('owned photo loads authenticated bytes and reloads when the persisted revision changes', async () => {
  const originalReader = globalThis.FileReader;
  const read = jest.fn();
  class TestReader {
    result = 'data:image/jpeg;base64,aW1hZ2U=';
    readyState = 2;
    onload?: () => void;
    readAsDataURL(blob: Blob) {
      read(blob);
      this.onload?.();
    }
  }
  globalThis.FileReader = TestReader as unknown as typeof FileReader;
  const blob = new Blob(['image'], { type: 'image/jpeg' });
  jest.mocked(getProfilePicture).mockResolvedValue(blob);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const account = {
    ...completeAccount,
    profile: { ...completeAccount.profile, picture_url: '/api/v1/me/profile/picture' },
  };
  const view = render(
    <QueryClientProvider client={client}>
      <ProfileAvatar account={account} />
    </QueryClientProvider>,
  );
  await screen.findByLabelText('Profile picture');
  expect(screen.getByLabelText('Profile picture').props.source.uri).toMatch(
    /^data:image\/jpeg;base64,/,
  );
  expect(getProfilePicture).toHaveBeenCalledWith(expect.any(AbortSignal));
  view.rerender(
    <QueryClientProvider client={client}>
      <ProfileAvatar
        account={{
          ...account,
          profile: { ...account.profile, updated_at: '2026-10-25T20:00:00Z' },
        }}
      />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(getProfilePicture).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(client.isFetching()).toBe(0));
  expect(read).toHaveBeenCalledWith(blob);
  view.unmount();
  globalThis.FileReader = originalReader;
});
