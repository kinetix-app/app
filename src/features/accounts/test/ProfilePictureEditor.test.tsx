import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { ProfilePictureEditor } from '../components/ProfilePictureEditor';
import { removeProfilePicture, uploadProfilePicture } from '../api';
import { completeAccount } from './fixtures';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('../api', () => ({ uploadProfilePicture: jest.fn(), removeProfilePicture: jest.fn() }));
const onChanged = jest.fn();
const onBusy = jest.fn();
const asset = {
  uri: 'file:///photo.jpg',
  width: 200,
  height: 200,
  mimeType: 'image/jpeg',
  fileSize: 2000,
};
function show() {
  function Wrapper() {
    const [account, setAccount] = useState(completeAccount);
    return (
      <ProfilePictureEditor
        account={account}
        onChanged={(value) => {
          onChanged(value);
          setAccount(value);
        }}
        onBusy={onBusy}
      />
    );
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Wrapper />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({ granted: true } as ImagePicker.MediaLibraryPermissionResponse);
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValue({ canceled: false, assets: [asset] });
});

test('selection previews, failed upload retains it and retry only updates after success', async () => {
  jest
    .mocked(uploadProfilePicture)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(completeAccount);
  show();
  fireEvent.press(screen.getByText('Choose picture'));
  await screen.findByText('Upload picture');
  expect(screen.getByLabelText('Profile picture').props.source.uri).toBe(asset.uri);
  fireEvent.press(screen.getByText('Upload picture'));
  await screen.findByText(
    'Could not upload your picture. Your selection is kept. Try again or skip it.',
  );
  expect(onChanged).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Profile picture').props.source.uri).toBe(asset.uri);
  fireEvent.press(screen.getByText('Upload picture'));
  await waitFor(() => expect(onChanged).toHaveBeenCalledWith(completeAccount));
  expect(uploadProfilePicture).toHaveBeenCalledWith(expect.any(FormData));
});

test('permission denial, cancellation and oversized files never upload', async () => {
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValueOnce({ granted: false } as ImagePicker.MediaLibraryPermissionResponse);
  show();
  fireEvent.press(screen.getByText('Choose picture'));
  await screen.findByText(
    'Photo access is needed to choose a picture. Allow access in Settings, then try again.',
  );
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValueOnce({ canceled: true, assets: null });
  fireEvent.press(screen.getByText('Choose picture'));
  await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1));
  await screen.findByText('Choose picture');
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValueOnce({ canceled: false, assets: [{ ...asset, fileSize: 6000000 }] });
  fireEvent.press(screen.getByText('Choose picture'));
  await screen.findByText('Choose a picture smaller than 5 MB.');
  expect(uploadProfilePicture).not.toHaveBeenCalled();
  expect(removeProfilePicture).not.toHaveBeenCalled();
});
