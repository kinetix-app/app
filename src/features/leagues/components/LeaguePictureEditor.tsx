import { getTranslation } from '@/i18n/catalog';
import { useLanguage } from '@/i18n/Language';
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
  const language = useLanguage();

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
      if (result && 'error' in result) {
        const spanishErrors: Record<string, string> = {
          'Allow photo access in Settings to choose a league picture.':
            'Permite el acceso a fotos en Ajustes para elegir una imagen de liga.',
          'Choose a picture smaller than 5 MB.': 'Elige una imagen de menos de 5 MB.',
          'Choose a JPEG, PNG or WebP picture.': 'Elige una imagen JPEG, PNG o WebP.',
          'Could not open your photos. Try again.':
            'No se pudieron abrir tus fotos. Inténtalo de nuevo.',
        };
        setError(language === 'es' ? (spanishErrors[result.error] ?? result.error) : result.error);
      } else if (result) onChange(result.asset);
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
          name={name || getTranslation(language)('socialAdditional.league_5e61e1')}
          path={visiblePath}
          preview={draft?.uri}
          size={64}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[textStyles.label, { color: p.ink }]}>
            {getTranslation(language)('socialAdditional.leaguePicture_116b57')}
          </Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            {busy
              ? getTranslation(language)('socialAdditional.openingPhotos_6e286d')
              : 'JPEG, PNG or WebP · up to 5 MB'}
          </Text>
        </View>
        {hasPicture ? (
          <LeagueIconButton
            label={getTranslation(language)('socialAdditional.removeLeaguePicture_6ae4dc')}
            icon="trash-outline"
            disabled={busy || disabled}
            onPress={() => {
              setError('');
              onChange(null);
            }}
          />
        ) : null}
        <LeagueIconButton
          label={
            hasPicture
              ? getTranslation(language)('socialAdditional.replaceLeaguePicture_c971dd')
              : getTranslation(language)('socialAdditional.chooseLeaguePicture_387e38')
          }
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
