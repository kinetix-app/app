import { getTranslation } from '@/i18n/catalog';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { Language } from '@/i18n/Language';

export async function pickRoutinePicture(
  language: Language = 'en',
): Promise<{ asset: ImagePicker.ImagePickerAsset } | { error: string } | null> {
  try {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        return {
          error: getTranslation(language)('training.allowPhotoAccessInSettingsToChoose_e96f35'),
        };
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.9,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) return null;
    if ((asset.fileSize ?? asset.file?.size ?? 0) > 5 * 1024 * 1024)
      return {
        error: getTranslation(language)('training.chooseACoverSmallerThan5Mb_e3f9e7'),
      };
    if (asset.mimeType && !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType))
      return {
        error: getTranslation(language)('training.chooseAJpegPngOrWebpCover_6b72e2'),
      };
    return { asset };
  } catch {
    return {
      error: getTranslation(language)('training.couldNotOpenYourPhotosTryAgain_1be001'),
    };
  }
}

export function routinePictureForm(asset: ImagePicker.ImagePickerAsset) {
  const form = new FormData();
  if (Platform.OS === 'web' && asset.file)
    form.append('file', asset.file, asset.fileName ?? 'routine.jpg');
  else
    form.append('file', {
      uri: asset.uri,
      name: asset.fileName ?? 'routine.jpg',
      type: asset.mimeType ?? 'image/jpeg',
    } as unknown as Blob);
  return form;
}
