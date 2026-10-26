import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ProfileEditor } from '../components/ProfileEditor';
import * as ImagePicker from 'expo-image-picker';
import { removeProfilePicture, uploadProfilePicture, updateProfile } from '../api';
import { completeAccount, incompleteAccount } from './fixtures';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('../api', () => ({
  updateProfile: jest.fn(),
  uploadProfilePicture: jest.fn(),
  removeProfilePicture: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
beforeEach(() => jest.clearAllMocks());
function show(account = completeAccount, onSaved = jest.fn(), onCancel?: () => void) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProfileEditor account={account} onSaved={onSaved} onCancel={onCancel} />
    </QueryClientProvider>,
  );
  return onSaved;
}
function next() {
  fireEvent.press(screen.getByText('Continue'));
}
function review() {
  next();
  next();
}

test('step validation requires explicit units and back retains values', async () => {
  show(incompleteAccount);
  next();
  expect(screen.getByText('Enter your name.')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Name'), 'Updated name');
  next();
  expect(screen.queryByLabelText('Name')).toBeNull();
  next();
  expect(screen.getByText('Enter an age from 1 to 120.')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Age (years)'), '25');
  next();
  expect(screen.getByText('Choose Metric or Imperial.')).toBeTruthy();
  fireEvent.press(screen.getByRole('radio', { name: 'Metric' }));
  fireEvent.changeText(screen.getByLabelText('Weight'), '70');
  fireEvent.changeText(screen.getByLabelText('Height (cm)'), '170');
  next();
  expect(screen.getByText('Confirmation')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Back'));
  expect(screen.getByLabelText('Age (years)').props.value).toBe('25');
  fireEvent.press(screen.getByLabelText('Back'));
  expect(screen.getByLabelText('Name').props.value).toBe('Updated name');
  expect(updateProfile).not.toHaveBeenCalled();
});

test('failed save retains entries and retry omits picture field', async () => {
  jest
    .mocked(updateProfile)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(completeAccount);
  const onSaved = show();
  fireEvent.changeText(screen.getByLabelText('Name'), 'Updated name');
  next();
  fireEvent.press(screen.getByRole('radio', { name: 'Imperial' }));
  fireEvent.changeText(screen.getByLabelText('Weight'), '100');
  next();
  fireEvent.press(screen.getByText('Save profile'));
  await screen.findByText(
    'Could not save your profile. Your details and picture choice are kept. Try again.',
  );
  const patch = jest.mocked(updateProfile).mock.calls[0][1];
  expect(patch).toMatchObject({
    display_name: 'Updated name',
    weight_kg: '45.359237',
    measurement_system: 'imperial',
  });
  expect(patch).not.toHaveProperty('picture_url');
  fireEvent.press(screen.getByText('Save profile'));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(completeAccount));
});

test('pending profile save prevents duplicates and preserves persisted precision', async () => {
  let resolve: (account: typeof completeAccount) => void = () => {};
  jest.mocked(updateProfile).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const onSaved = show({
    ...completeAccount,
    profile: { ...completeAccount.profile, weight_kg: '45.359237', measurement_system: 'imperial' },
  });
  review();
  fireEvent.press(screen.getByText('Save profile'));
  await screen.findByText('Saving…');
  fireEvent.press(screen.getByText('Saving…'));
  expect(updateProfile).toHaveBeenCalledTimes(1);
  expect(jest.mocked(updateProfile).mock.calls[0][1]).toMatchObject({ weight_kg: '45.359237' });
  await act(async () => resolve(completeAccount));
  expect(onSaved).toHaveBeenCalledTimes(1);
});

test('measurement system converts displayed height and weight to two decimals', () => {
  show();
  next();
  fireEvent.press(screen.getByRole('radio', { name: 'Imperial' }));
  expect(screen.getByLabelText('Weight').props.value).toBe('154.32');
  expect(screen.getByLabelText('Height (feet)').props.value).toBe('5');
  expect(screen.getByLabelText('Height (inches)').props.value).toBe('6.93');
  fireEvent.press(screen.getByRole('radio', { name: 'Metric' }));
  expect(screen.getByLabelText('Weight').props.value).toBe('70.00');
  expect(screen.getByLabelText('Height (cm)').props.value).toBe('170.00');
});

test('switching systems without editing preserves canonical height and weight precision', async () => {
  jest.mocked(updateProfile).mockResolvedValue(completeAccount);
  show({
    ...completeAccount,
    profile: { ...completeAccount.profile, height_cm: '182.87', weight_kg: '70.123456' },
  });
  next();
  fireEvent.press(screen.getByRole('radio', { name: 'Imperial' }));
  expect(screen.getByLabelText('Height (feet)').props.value).toBe('6');
  expect(screen.getByLabelText('Height (inches)').props.value).toBe('0.00');
  fireEvent.press(screen.getByRole('radio', { name: 'Metric' }));
  expect(screen.getByLabelText('Height (cm)').props.value).toBe('182.87');
  next();
  fireEvent.press(screen.getByText('Save profile'));
  await waitFor(() => expect(updateProfile).toHaveBeenCalled());
  expect(jest.mocked(updateProfile).mock.calls[0][1]).toMatchObject({
    height_cm: '182.87',
    weight_kg: '70.123456',
    measurement_system: 'metric',
  });
});

test('choosing a first system for an existing incomplete profile converts its saved mass', () => {
  show({ ...completeAccount, profile: { ...completeAccount.profile, measurement_system: null } });
  next();
  fireEvent.press(screen.getByRole('radio', { name: 'Imperial' }));
  expect(screen.getByLabelText('Weight').props.value).toBe('154.32');
  expect(screen.getByLabelText('Height (inches)').props.value).toBe('6.93');
});

test('photo stays local until confirmation; upload failure retains preview and successful upload is not repeated after profile failure', async () => {
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({ granted: true } as ImagePicker.MediaLibraryPermissionResponse);
  const asset = {
    uri: 'file:///selected.jpg',
    width: 200,
    height: 200,
    mimeType: 'image/jpeg',
    fileSize: 1000,
  };
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValue({ canceled: false, assets: [asset] });
  jest
    .mocked(uploadProfilePicture)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(completeAccount);
  jest
    .mocked(updateProfile)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(completeAccount);
  const onSaved = show();
  expect(screen.queryByText('Sign out')).toBeNull();
  fireEvent.press(screen.getByLabelText('Choose picture'));
  await screen.findByText('Picture ready · saved when you confirm');
  expect(uploadProfilePicture).not.toHaveBeenCalled();
  review();
  expect(screen.getByLabelText('Profile picture').props.source.uri).toBe(asset.uri);
  fireEvent.press(screen.getByText('Save profile'));
  await screen.findByText(
    'Could not save your profile. Your details and picture choice are kept. Try again.',
  );
  expect(updateProfile).not.toHaveBeenCalled();
  expect(onSaved).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Save profile'));
  await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
  await screen.findByText(
    'Could not save your profile. Your details and picture choice are kept. Try again.',
  );
  fireEvent.press(screen.getByText('Save profile'));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(completeAccount));
  expect(uploadProfilePicture).toHaveBeenCalledTimes(2);
  expect(removeProfilePicture).not.toHaveBeenCalled();
});

test('photo deletion is staged locally until the final confirmation', async () => {
  jest.mocked(removeProfilePicture).mockResolvedValue(completeAccount);
  jest.mocked(updateProfile).mockResolvedValue(completeAccount);
  show({
    ...completeAccount,
    profile: { ...completeAccount.profile, picture_url: 'https://example.test/photo.jpg' },
  });
  fireEvent.press(screen.getByLabelText('Remove picture'));
  expect(removeProfilePicture).not.toHaveBeenCalled();
  review();
  expect(screen.queryByLabelText('Profile picture')).toBeNull();
  fireEvent.press(screen.getByText('Save profile'));
  await waitFor(() => expect(updateProfile).toHaveBeenCalled());
  expect(removeProfilePicture).toHaveBeenCalledTimes(1);
});

test('cancel discards a selected picture without server mutations', async () => {
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({ granted: true } as ImagePicker.MediaLibraryPermissionResponse);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///local.jpg', width: 100, height: 100, mimeType: 'image/jpeg' }],
  });
  const onCancel = jest.fn();
  show(completeAccount, jest.fn(), onCancel);
  fireEvent.press(screen.getByLabelText('Choose picture'));
  await screen.findByText('Picture ready · saved when you confirm');
  fireEvent.press(screen.getByText('Cancel'));
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(uploadProfilePicture).not.toHaveBeenCalled();
  expect(removeProfilePicture).not.toHaveBeenCalled();
  expect(updateProfile).not.toHaveBeenCalled();
});
