import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export async function pickLeaguePicture(): Promise<
  { asset: ImagePicker.ImagePickerAsset } | { error: string } | null
> {
  try {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        return { error: 'Allow photo access in Settings to choose a league picture.' };
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      allowsEditing: Platform.OS !== 'web',
      aspect: [1, 1],
      quality: 0.9,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) return null;
    if ((asset.fileSize ?? asset.file?.size ?? 0) > 5 * 1024 * 1024)
      return { error: 'Choose a picture smaller than 5 MB.' };
    const type = asset.mimeType ?? asset.file?.type;
    if (type && !['image/jpeg', 'image/png', 'image/webp'].includes(type))
      return { error: 'Choose a JPEG, PNG or WebP picture.' };
    return { asset };
  } catch {
    return { error: 'Could not open your photos. Try again.' };
  }
}

export function leaguePictureForm(asset: ImagePicker.ImagePickerAsset) {
  const form = new FormData();
  if (Platform.OS === 'web' && asset.file)
    form.append('file', asset.file, asset.fileName ?? 'league.jpg');
  else
    form.append('file', {
      uri: asset.uri,
      name: asset.fileName ?? 'league.jpg',
      type: asset.mimeType ?? 'image/jpeg',
    } as unknown as Blob);
  return form;
}

export function leagueConfigurationForm(data: object, asset?: ImagePicker.ImagePickerAsset) {
  const form = asset ? leaguePictureForm(asset) : new FormData();
  form.append('data', JSON.stringify(data));
  return form;
}
