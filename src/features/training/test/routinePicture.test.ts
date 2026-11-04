import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { pickRoutinePicture, routinePictureForm } from '../components/routinePicture';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const nativePlatform = Platform.OS;
const asset = { uri: 'file:///cover.jpg', width: 100, height: 100 };
beforeEach(() => {
  jest.resetAllMocks();
  Platform.OS = nativePlatform;
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
    granted: true,
  } as ImagePicker.MediaLibraryPermissionResponse);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [asset],
  });
});
afterEach(() => {
  Platform.OS = nativePlatform;
});

test('permission denial does not open the picker', async () => {
  Platform.OS = 'ios';
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
    granted: false,
  } as ImagePicker.MediaLibraryPermissionResponse);
  expect(await pickRoutinePicture()).toEqual({
    error: 'Allow photo access in Settings to choose a cover.',
  });
  expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
});

test('web selection skips native permissions and preserves the browser file', async () => {
  Platform.OS = 'web';
  const file = new File(['picture'], 'cover.png', { type: 'image/png' });
  const browserAsset = { ...asset, file, mimeType: 'image/png', fileName: 'cover.png' };
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [browserAsset],
  });
  expect(await pickRoutinePicture()).toEqual({ asset: browserAsset });
  expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  const append = jest.spyOn(FormData.prototype, 'append');
  routinePictureForm(browserAsset);
  expect(append).toHaveBeenCalledWith('file', file, 'cover.png');
  append.mockRestore();
});

test.each([
  { canceled: true, assets: null },
  { canceled: false, assets: [] },
] as ImagePicker.ImagePickerResult[])(
  'cancellation or an empty selection leaves the draft alone',
  async (result) => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue(result);
    expect(await pickRoutinePicture()).toBeNull();
  },
);

test.each([
  [{ ...asset, fileSize: 5 * 1024 * 1024 + 1 }, 'Choose a cover smaller than 5 MB.'],
  [{ ...asset, file: new File(['123'], 'cover.png'), fileSize: undefined }, null],
  [{ ...asset, mimeType: 'image/gif' }, 'Choose a JPEG, PNG or WebP cover.'],
] as const)('validates picture metadata before accepting a draft', async (picture, error) => {
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValue({ canceled: false, assets: [picture] });
  expect(await pickRoutinePicture()).toEqual(error ? { error } : { asset: picture });
});

test('picker failure is recoverable and a later native selection can be uploaded', async () => {
  Platform.OS = 'android';
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockRejectedValueOnce(new Error('unavailable'));
  expect(await pickRoutinePicture()).toEqual({ error: 'Could not open your photos. Try again.' });
  expect(await pickRoutinePicture()).toEqual({ asset });
  const append = jest.spyOn(FormData.prototype, 'append');
  routinePictureForm(asset);
  expect(append).toHaveBeenCalledWith('file', {
    uri: asset.uri,
    name: 'routine.jpg',
    type: 'image/jpeg',
  });
  append.mockRestore();
});
