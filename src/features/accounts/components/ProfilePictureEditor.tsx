import { getTranslation } from '@/i18n/catalog';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLanguage, type Language } from '@/i18n/Language';
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

function getPictureStatus(
  draft: ProfilePictureDraft,
  account: Account,
  compact: boolean,
  language: Language,
) {
  if (compact) {
    if (draft.kind === 'select')
      return getTranslation(language)('accountsUi.new_picture_save_to_apply');
    if (draft.kind === 'remove')
      return getTranslation(language)('accountsUi.picture_removed_save_to_apply');
    return getTranslation(language)('accountsUi.profile_picture');
  }
  if (draft.kind === 'select')
    return getTranslation(language)('accountsUi.picture_ready_saved_when_you_confirm');
  if (draft.kind === 'remove')
    return getTranslation(language)('accountsUi.no_picture_removal_saved_when_you_confirm');
  if (account.profile.picture_url)
    return getTranslation(language)('accountsUi.current_profile_picture');
  return getTranslation(language)('accountsUi.no_picture_optional');
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
  const language = useLanguage();
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
            getTranslation(language)(
              'accountsUi.photo_access_is_needed_to_choose_a_picture_allow_access_in_s',
            ),
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
        setError(getTranslation(language)('accountsUi.choose_a_picture_smaller_than_5_mb'));
        return;
      }
      const type = asset.mimeType ?? asset.file?.type;
      if (type && !['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
        setError(getTranslation(language)('accountsUi.choose_a_jpeg_png_or_webp_picture'));
        return;
      }
      onDraftChange({ kind: 'select', asset });
    } catch {
      setError(getTranslation(language)('accountsUi.could_not_open_your_photos_try_again'));
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
          accessibilityLabel={
            hasPicture
              ? getTranslation(language)('accountsUi.replace_picture')
              : getTranslation(language)('accountsUi.choose_picture')
          }
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
            accessibilityLabel={getTranslation(language)('accountsUi.remove_picture')}
            accessibilityHint={
              compact
                ? getTranslation(language)(
                    'accountsUi.remove_this_picture_when_you_save_your_profile',
                  )
                : getTranslation(language)(
                    'accountsUi.remove_this_picture_when_you_confirm_your_profile',
                  )
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
            {getTranslation(language)('accountsUi.opening_photos')}
          </Text>
        </View>
      ) : (
        <Text
          accessibilityLiveRegion="polite"
          style={[textStyles.label, { color: p['ink-muted'] }]}
        >
          {getPictureStatus(draft, account, compact, language)}
        </Text>
      )}
      {!compact ? (
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'], textAlign: 'center' }]}>
          {getTranslation(language)('accountsUi.jpeg_png_or_webp_up_to_5_mb')}
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
