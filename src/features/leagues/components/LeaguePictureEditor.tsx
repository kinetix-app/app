import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { ApiError } from '@/services/apiClient';
import { textStyles, usePalette } from '@/theme/tokens';
import { leaguesApi } from '../api';
import type { LeagueDetail } from '../schemas';
import { LeagueAvatar } from './LeagueAvatar';
import { LeagueAction, leagueStyles } from './LeagueUI';
import { leaguePictureForm, pickLeaguePicture } from './leaguePicture';

export function LeaguePictureEditor({
  accountId,
  league,
  onBusy,
  disabled = false,
}: Readonly<{
  accountId: number;
  league: LeagueDetail;
  onBusy: (busy: boolean) => void;
  disabled?: boolean;
}>) {
  const p = usePalette();
  const cache = useQueryClient();
  const [asset, setAsset] = useState<ImagePickerAsset>();
  const [error, setError] = useState('');
  const [choosing, setChoosing] = useState(false);
  const locked = useRef(false);
  const save = useMutation({
    mutationFn: (operation: 'save' | 'remove') =>
      operation === 'remove'
        ? leaguesApi.removePicture(league.id)
        : leaguesApi.uploadPicture(league.id, leaguePictureForm(asset!)),
    onSuccess: (updated) => {
      cache.setQueryData(['leagues', accountId, league.id], updated);
      void cache.invalidateQueries({ queryKey: ['leagues', accountId] });
      setAsset(undefined);
      setError('');
    },
    onError: (e) =>
      setError(
        e instanceof ApiError && e.status === 413
          ? 'Choose a picture smaller than 5 MB.'
          : e instanceof ApiError && [415, 422].includes(e.status)
            ? 'Choose a valid JPEG, PNG or WebP picture.'
            : 'Could not save the league picture. Please try again.',
      ),
    onSettled: () => {
      locked.current = false;
      onBusy(false);
    },
  });
  async function choose() {
    if (locked.current || disabled) return;
    locked.current = true;
    setChoosing(true);
    onBusy(true);
    setError('');
    try {
      const result = await pickLeaguePicture();
      if (result && 'error' in result) setError(result.error);
      else if (result) setAsset(result.asset);
    } finally {
      locked.current = false;
      setChoosing(false);
      onBusy(false);
    }
  }
  function apply(operation: 'save' | 'remove') {
    if (locked.current || disabled || (operation === 'save' && !asset)) return;
    locked.current = true;
    onBusy(true);
    save.mutate(operation);
  }
  const busy = disabled || choosing || save.isPending;
  return (
    <View style={leagueStyles.section}>
      <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
        League picture
      </Text>
      <View style={{ alignItems: 'center' }}>
        <LeagueAvatar
          accountId={accountId}
          path={league.picture_url}
          preview={asset?.uri}
          name={league.name}
          size={112}
          retryable
        />
      </View>
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        JPEG, PNG or WebP · up to 5 MB
      </Text>
      <LeagueAction
        label={
          choosing
            ? 'Opening photos…'
            : asset || league.picture_url
              ? 'Replace league picture'
              : 'Choose league picture'
        }
        icon="image-outline"
        variant="positive"
        disabled={busy}
        onPress={() => {
          void choose();
        }}
      />
      {asset ? (
        <>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            New picture · Save to apply
          </Text>
          <LeagueAction
            label={save.isPending ? 'Saving…' : 'Save picture'}
            variant="primary"
            disabled={busy}
            onPress={() => apply('save')}
          />
          <LeagueAction
            label="Cancel picture change"
            disabled={busy}
            onPress={() => {
              setAsset(undefined);
              setError('');
            }}
          />
        </>
      ) : league.picture_url ? (
        <LeagueAction
          label={save.isPending ? 'Removing…' : 'Remove league picture'}
          disabled={busy}
          onPress={() => apply('remove')}
        />
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
