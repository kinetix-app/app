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
          error:
            language === 'es'
              ? 'Permite el acceso a las fotos en Ajustes para elegir una portada.'
              : 'Allow photo access in Settings to choose a cover.',
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
        error:
          language === 'es'
            ? 'Elige una portada de menos de 5 MB.'
            : 'Choose a cover smaller than 5 MB.',
      };
    if (asset.mimeType && !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType))
      return {
        error:
          language === 'es'
            ? 'Elige una portada en JPEG, PNG o WebP.'
            : 'Choose a JPEG, PNG or WebP cover.',
      };
    return { asset };
  } catch {
    return {
      error:
        language === 'es'
          ? 'No se pudieron abrir tus fotos. Inténtalo de nuevo.'
          : 'Could not open your photos. Try again.',
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
