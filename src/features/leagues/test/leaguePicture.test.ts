import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { leagueConfigurationForm, pickLeaguePicture } from '../components/leaguePicture';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const asset = { uri: 'file:///league.png', width: 128, height: 128, mimeType: 'image/png' };
const permission = (granted: boolean) =>
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
    granted,
  } as ImagePicker.MediaLibraryPermissionResponse);
const picker = jest.mocked(ImagePicker.launchImageLibraryAsync);

beforeEach(() => {
  jest.resetAllMocks();
  permission(true);
});
afterEach(() => jest.restoreAllMocks());

test('asks for native photo permission before opening the picker', async () => {
  permission(false);
  await expect(pickLeaguePicture()).resolves.toEqual({
    error: 'Allow photo access in Settings to choose a league picture.',
  });
  expect(picker).not.toHaveBeenCalled();
});

test('leaves the picture unchanged on cancel and reports picker failures', async () => {
  picker.mockResolvedValueOnce({ canceled: true, assets: null });
  await expect(pickLeaguePicture()).resolves.toBeNull();
  picker.mockRejectedValueOnce(new Error('Unavailable'));
  await expect(pickLeaguePicture()).resolves.toEqual({
    error: 'Could not open your photos. Try again.',
  });
});

test.each([
  [{ ...asset, fileSize: 5 * 1024 * 1024 + 1 }, 'Choose a picture smaller than 5 MB.'],
  [{ ...asset, mimeType: 'image/gif' }, 'Choose a JPEG, PNG or WebP picture.'],
])('rejects unsuitable league photos before staging the upload', async (candidate, error) => {
  picker.mockResolvedValue({ canceled: false, assets: [candidate] });
  await expect(pickLeaguePicture()).resolves.toEqual({ error });
});

test('stages the chosen photo with the configuration in one multipart request', async () => {
  picker.mockResolvedValue({ canceled: false, assets: [asset] });
  await expect(pickLeaguePicture()).resolves.toEqual({ asset });
  const append = jest.spyOn(FormData.prototype, 'append');
  leagueConfigurationForm({ name: 'Early birds' }, asset);
  expect(append).toHaveBeenNthCalledWith(1, 'file', {
    uri: asset.uri,
    name: 'league.jpg',
    type: 'image/png',
  });
  expect(append).toHaveBeenNthCalledWith(2, 'data', '{"name":"Early birds"}');
});

test('uses the actual selected file on web without prompting for native permission', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const file = new File(['image'], 'badge.webp', { type: 'image/webp' });
  const selection = { ...asset, file, fileName: file.name, mimeType: undefined };
  picker.mockResolvedValue({ canceled: false, assets: [selection] });
  await expect(pickLeaguePicture()).resolves.toEqual({ asset: selection });
  expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  expect(picker).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: false }));
  const append = jest.spyOn(FormData.prototype, 'append');
  leagueConfigurationForm({ name: 'Early birds' }, selection);
  expect(append).toHaveBeenCalledWith('file', file, 'badge.webp');
});
