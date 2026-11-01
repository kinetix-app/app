import React, { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import type { Account } from '../schemas';
import { ProfileAvatar } from './ProfileAvatar';

export type ProfilePictureDraft =
  { kind: 'keep' } | { kind: 'remove' } | { kind: 'select'; asset: ImagePicker.ImagePickerAsset };
type ProfilePictureEditorProps = Readonly<{
  account: Account;
  draft: ProfilePictureDraft;
  onDraftChange: (draft: ProfilePictureDraft) => void;
  onBusy: (busy: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}>;

function getPictureStatus(draft: ProfilePictureDraft, account: Account) {
  if (draft.kind === 'select') return 'Picture ready · saved when you confirm';
  if (draft.kind === 'remove') return 'No picture · removal saved when you confirm';
  if (account.profile.picture_url) return 'Current profile picture';
  return 'No picture · optional';
}

export function ProfilePictureEditor({
  account,
  draft,
  onDraftChange,
  onBusy,
  disabled = false,
  compact = false,
}: ProfilePictureEditorProps) {
  const p = usePalette();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const selection = draft.kind === 'select' ? draft.asset : undefined;
  const visibleAccount =
    draft.kind === 'remove'
      ? { ...account, profile: { ...account.profile, picture_url: null } }
      : account;
  const hasPicture = selection || visibleAccount.profile.picture_url;
  const locked = pending || disabled;
  function setBusy(value: boolean) {
    busy.current = value;
    setPending(value);
    onBusy(value);
  }
  async function choose() {
    if (busy.current || disabled) return;
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
      onDraftChange({ kind: 'select', asset });
    } catch {
      setError('Could not open your photos. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: spacing['space-3'], alignItems: 'center' }}>
      <View
        style={{
          position: 'relative',
          paddingHorizontal: spacing['space-6'],
          paddingBottom: spacing['space-2'],
        }}
      >
        <ProfileAvatar
          account={visibleAccount}
          preview={selection?.uri}
          size={compact ? 64 : 112}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hasPicture ? 'Replace picture' : 'Choose picture'}
          accessibilityState={{ disabled: locked }}
          disabled={locked}
          onPress={() => {
            void choose();
          }}
          style={[
            styles.icon,
            { right: 0, backgroundColor: p['brand-soft'], borderColor: p['line-strong'] },
          ]}
        >
          <Feather name="edit-2" size={20} color={p['brand-ink']} />
        </Pressable>
        {hasPicture ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove picture"
            accessibilityHint={
              compact
                ? 'Remove this picture when you save your profile.'
                : 'Remove this picture when you confirm your profile.'
            }
            accessibilityState={{ disabled: locked }}
            disabled={locked}
            onPress={() => {
              onDraftChange({ kind: 'remove' });
              setError('');
            }}
            style={[
              styles.icon,
              { left: 0, backgroundColor: p['surface-300'], borderColor: p['line-strong'] },
            ]}
          >
            <Feather name="trash-2" size={20} color={p.danger} />
          </Pressable>
        ) : null}
      </View>
      {pending ? (
        <View style={{ flexDirection: 'row', gap: spacing['space-2'], alignItems: 'center' }}>
          <ActivityIndicator color={p.brand} />
          <Text accessibilityLiveRegion="polite" style={[textStyles.label, { color: p.ink }]}>
            Opening photos…
          </Text>
        </View>
      ) : (
        <Text
          accessibilityLiveRegion="polite"
          style={[textStyles.label, { color: p['ink-muted'] }]}
        >
          {compact
            ? draft.kind === 'select'
              ? 'New picture · Save to apply'
              : draft.kind === 'remove'
                ? 'Picture removed · Save to apply'
                : 'Profile picture'
            : getPictureStatus(draft, account)}
        </Text>
      )}
      {!compact ? (
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'], textAlign: 'center' }]}>
          JPEG, PNG or WebP · up to 5 MB
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  icon: {
    position: 'absolute',
    bottom: 0,
    width: sizes['tap-min'],
    height: sizes['tap-min'],
    borderRadius: radii['radius-pill'],
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
