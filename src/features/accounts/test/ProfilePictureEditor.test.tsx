import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { ProfilePictureEditor, type ProfilePictureDraft } from '../components/ProfilePictureEditor';
import { removeProfilePicture, uploadProfilePicture } from '../api';
import { completeAccount } from './fixtures';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('../api', () => ({ uploadProfilePicture: jest.fn(), removeProfilePicture: jest.fn() }));
const onDraftChange = jest.fn();
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
    const [draft, setDraft] = useState<ProfilePictureDraft>({ kind: 'keep' });
    return (
      <ProfilePictureEditor
        account={completeAccount}
        draft={draft}
        onDraftChange={(value) => {
          onDraftChange(value);
          setDraft(value);
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

test('selection previews and removal stay local without any upload controls or writes', async () => {
  show();
  fireEvent.press(screen.getByLabelText('Choose picture'));
  await screen.findByText('Picture ready · saved when you confirm');
  expect(screen.getByLabelText('Profile picture').props.source.uri).toBe(asset.uri);
  expect(screen.queryByText('Upload picture')).toBeNull();
  expect(uploadProfilePicture).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Remove picture'));
  expect(screen.queryByLabelText('Profile picture')).toBeNull();
  expect(removeProfilePicture).not.toHaveBeenCalled();
  expect(onDraftChange).toHaveBeenLastCalledWith({ kind: 'remove' });
});

test('permission denial, cancellation and oversized files never upload', async () => {
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValueOnce({ granted: false } as ImagePicker.MediaLibraryPermissionResponse);
  show();
  fireEvent.press(screen.getByLabelText('Choose picture'));
  await screen.findByText(
    'Photo access is needed to choose a picture. Allow access in Settings, then try again.',
  );
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValueOnce({ canceled: true, assets: null });
  fireEvent.press(screen.getByLabelText('Choose picture'));
  await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1));
  await screen.findByLabelText('Choose picture');
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValueOnce({ canceled: false, assets: [{ ...asset, fileSize: 6000000 }] });
  fireEvent.press(screen.getByLabelText('Choose picture'));
  await screen.findByText('Choose a picture smaller than 5 MB.');
  expect(uploadProfilePicture).not.toHaveBeenCalled();
  expect(removeProfilePicture).not.toHaveBeenCalled();
});
