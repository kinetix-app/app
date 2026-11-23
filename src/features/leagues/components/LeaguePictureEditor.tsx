import type { ImagePickerAsset } from 'expo-image-picker';
import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { textStyles, usePalette } from '@/theme/tokens';
import { LeagueAvatar } from './LeagueAvatar';
import { LeagueIconButton, leagueStyles } from './LeagueUI';
import { pickLeaguePicture } from './leaguePicture';

export type LeaguePictureDraft = ImagePickerAsset | null | undefined;

export function LeaguePictureEditor({
  accountId,
  name,
  path,
  draft,
  onChange,
  onBusy,
  disabled = false,
}: Readonly<{
  accountId: number;
  name: string;
  path?: string | null;
  draft: LeaguePictureDraft;
  onChange: (draft: LeaguePictureDraft) => void;
  onBusy: (busy: boolean) => void;
  disabled?: boolean;
}>) {
  const p = usePalette();
  const choosing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const visiblePath = draft === null ? null : path;
  const hasPicture = Boolean(draft || visiblePath);
  async function choose() {
    if (choosing.current || disabled) return;
    choosing.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      const result = await pickLeaguePicture();
      if (result && 'error' in result) setError(result.error);
      else if (result) onChange(result.asset);
    } finally {
      choosing.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <View style={leagueStyles.section}>
      <View style={leagueStyles.row}>
        <LeagueAvatar
          accountId={accountId}
          name={name || 'League'}
          path={visiblePath}
          preview={draft?.uri}
          size={64}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[textStyles.label, { color: p.ink }]}>League picture</Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            {busy ? 'Opening photos…' : 'JPEG, PNG or WebP · up to 5 MB'}
          </Text>
        </View>
        {hasPicture ? (
          <LeagueIconButton
            label="Remove league picture"
            icon="trash-outline"
            disabled={busy || disabled}
            onPress={() => {
              setError('');
              onChange(null);
            }}
          />
        ) : null}
        <LeagueIconButton
          label={hasPicture ? 'Replace league picture' : 'Choose league picture'}
          icon="image-outline"
          disabled={busy || disabled}
          onPress={() => {
            void choose();
          }}
        />
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
