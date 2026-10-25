import React, { useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ApiError } from '@/services/apiClient';
import { textStyles, usePalette } from '@/theme/tokens';
import { removeProfilePicture, uploadProfilePicture } from '../api';
import type { Account } from '../schemas';
import { ProfileAvatar } from './ProfileAvatar';
import { SetupButton } from './SetupUI';

export function ProfilePictureEditor({
  account,
  onChanged,
  onBusy,
}: {
  account: Account;
  onChanged: (account: Account) => void;
  onBusy: (busy: boolean) => void;
}) {
  const p = usePalette();
  const [selection, setSelection] = useState<ImagePicker.ImagePickerAsset>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const selectedRef = useRef<ImagePicker.ImagePickerAsset | undefined>(undefined);
  function setBusy(value: boolean) {
    busy.current = value;
    setPending(value);
    onBusy(value);
  }
  async function choose() {
    if (busy.current) return;
    setBusy(true);
    setError('');
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setError(
            'Photo access is needed to choose a picture. Allow access in Settings, then try again.',
          );
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        allowsEditing: Platform.OS !== 'web',
        aspect: [1, 1],
        quality: 0.9,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if ((asset.fileSize ?? asset.file?.size ?? 0) > 5 * 1024 * 1024) {
        setError('Choose a picture smaller than 5 MB.');
        return;
      }
      const type = asset.mimeType ?? asset.file?.type;
      if (type && !['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
        setError('Choose a JPEG, PNG or WebP picture.');
        return;
      }
      setSelection(asset);
      selectedRef.current = asset;
    } catch {
      setError('Could not open your photos. Try again.');
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    const asset = selectedRef.current;
    if (!asset || busy.current) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      if (Platform.OS === 'web' && asset.file)
        form.append('file', asset.file, asset.fileName ?? 'profile.jpg');
      else
        form.append('file', {
          uri: asset.uri,
          name: asset.fileName ?? 'profile.jpg',
          type: asset.mimeType ?? 'image/jpeg',
        } as unknown as Blob);
      const result = await uploadProfilePicture(form);
      onChanged(result);
      setSelection(undefined);
      selectedRef.current = undefined;
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 413
          ? 'Choose a picture smaller than 5 MB.'
          : 'Could not upload your picture. Your selection is kept. Try again or skip it.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (busy.current) return;
    setBusy(true);
    setError('');
    try {
      onChanged(await removeProfilePicture());
      setSelection(undefined);
      selectedRef.current = undefined;
    } catch {
      setError('Could not remove your picture. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 12 }}>
      <ProfileAvatar account={account} preview={selection?.uri} />
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'], textAlign: 'center' }]}>
        Add a photo to make your profile yours. Optional · JPEG, PNG or WebP · up to 5 MB
      </Text>
      <SetupButton
        title={
          pending
            ? 'Working…'
            : selection || account.profile.picture_url
              ? 'Replace picture'
              : 'Choose picture'
        }
        secondary
        disabled={pending}
        onPress={() => {
          void choose();
        }}
      />
      {selection ? (
        <>
          <SetupButton
            title="Upload picture"
            disabled={pending}
            onPress={() => {
              void upload();
            }}
          />
          <SetupButton
            title="Skip selected picture"
            secondary
            disabled={pending}
            onPress={() => {
              setSelection(undefined);
              selectedRef.current = undefined;
              setError('');
            }}
          />
        </>
      ) : null}
      {account.profile.picture_url ? (
        <SetupButton
          title="Remove picture"
          secondary
          disabled={pending}
          onPress={() => {
            void remove();
          }}
        />
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
