import React, { useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { RoutineCover } from './RoutineCover';
import { IconButton } from './ui';

export type RoutinePictureDraft =
  { kind: 'keep' } | { kind: 'remove' } | { kind: 'select'; asset: ImagePicker.ImagePickerAsset };

export function RoutinePictureEditor({
  accountId,
  routineId,
  path,
  draft,
  onChange,
  onBusy,
  disabled,
}: Readonly<{
  accountId: number;
  routineId?: number;
  path?: string | null;
  draft: RoutinePictureDraft;
  onChange: (draft: RoutinePictureDraft) => void;
  onBusy: (busy: boolean) => void;
  disabled: boolean;
}>) {
  const p = usePalette();
  const busy = useRef(false);
  const [error, setError] = useState('');
  async function choose() {
    if (busy.current || disabled) return;
    busy.current = true;
    onBusy(true);
    setError('');
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setError('Allow photo access in Settings to choose a cover.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.9,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      if ((asset.fileSize ?? asset.file?.size ?? 0) > 5 * 1024 * 1024) {
        setError('Choose a cover smaller than 5 MB.');
        return;
      }
      if (asset.mimeType && !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)) {
        setError('Choose a JPEG, PNG or WebP cover.');
        return;
      }
      onChange({ kind: 'select', asset });
    } catch {
      setError('Could not open your photos. Try again.');
    } finally {
      busy.current = false;
      onBusy(false);
    }
  }
  const hasPicture = draft.kind === 'select' || (draft.kind === 'keep' && Boolean(path));
  return (
    <View style={{ gap: spacing['space-2'] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['space-3'] }}>
        <RoutineCover
          accountId={accountId}
          routineId={routineId}
          path={draft.kind === 'keep' ? path : null}
          preview={draft.kind === 'select' ? draft.asset.uri : undefined}
          onOpen={() => void choose()}
          openLabel={hasPicture ? 'Replace routine cover' : 'Choose routine cover'}
          disabled={disabled}
        />
        <View style={{ flex: 1 }}>
          <Text style={[textStyles.label, { color: p.ink }]}>Routine cover</Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            {draft.kind === 'select'
              ? 'New cover · Save to apply'
              : draft.kind === 'remove'
                ? 'Cover removed · Save to apply'
                : 'Optional · JPEG, PNG or WebP · 5 MB'}
          </Text>
        </View>
        {hasPicture ? (
          <IconButton
            icon="x"
            label="Remove routine cover"
            disabled={disabled}
            onPress={() => {
              onChange({ kind: 'remove' });
              setError('');
            }}
          />
        ) : (
          <IconButton
            icon="image"
            label="Add routine cover"
            disabled={disabled}
            onPress={() => void choose()}
          />
        )}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
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
