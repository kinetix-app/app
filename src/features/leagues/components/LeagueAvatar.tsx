import { getTranslation } from '@/i18n/catalog';
import { useLanguage } from '@/i18n/Language';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { leaguesApi } from '../api';

function useLeaguePhoto(
  accountId: number,
  path?: string | null,
  preview?: string,
  invitationToken?: string,
) {
  const [decoded, setDecoded] = useState<{ blob: Blob; uri?: string; failed?: boolean }>();
  const [failedUri, setFailedUri] = useState<string>();
  const privatePhoto = Boolean(invitationToken || path?.startsWith('/api/v1/leagues/'));
  const photo = useQuery({
    queryKey: ['leagues', accountId, 'picture', path, invitationToken],
    queryFn: ({ signal }) =>
      invitationToken
        ? leaguesApi.invitationPicture(invitationToken, signal)
        : leaguesApi.picture(path!, signal),
    enabled: privatePhoto && !preview,
    gcTime: 0,
    retry: false,
  });
  useEffect(() => {
    if (!photo.data || !privatePhoto || preview) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setDecoded({ blob: photo.data, uri: reader.result });
    };
    reader.onerror = () => setDecoded({ blob: photo.data, failed: true });
    reader.readAsDataURL(photo.data);
    return () => {
      reader.onload = null;
      reader.onerror = null;
      if (reader.readyState === FileReader.LOADING) reader.abort();
    };
  }, [photo.data, privatePhoto, preview, accountId, path]);
  const decodedUri = decoded?.blob === photo.data ? decoded?.uri : undefined;
  const uri = preview ?? (privatePhoto ? decodedUri : (path ?? undefined));
  const fileFailed = decoded?.blob === photo.data && decoded?.failed;
  const privatePhotoFailed = !preview && (photo.isError || fileFailed);
  const failed = privatePhotoFailed || (uri && failedUri === uri);
  const retry = () => {
    setFailedUri(undefined);
    void photo.refetch();
  };
  return { uri, failed, loading: privatePhoto && !preview && !failed, setFailedUri, retry };
}

export function LeagueAvatar({
  accountId,
  path,
  name,
  member = false,
  size = 44,
  preview,
  retryable = false,
  invitationToken,
}: Readonly<{
  accountId: number;
  path?: string | null;
  name: string;
  member?: boolean;
  size?: number;
  preview?: string;
  retryable?: boolean;
  invitationToken?: string;
}>) {
  const language = useLanguage();
  const p = usePalette();
  const { uri, failed, loading, setFailedUri, retry } = useLeaguePhoto(
    accountId,
    path,
    preview,
    invitationToken,
  );
  let label: string;
  if (member) label = getTranslation(language)('leagues.profilePicture', { name });
  else label = getTranslation(language)('leagues.leaguePicture', { name });
  return (
    <View style={{ alignItems: 'center', gap: spacing['space-2'], flexShrink: 0 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radii['radius-pill'],
          backgroundColor: p['brand-soft'],
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LeagueAvatarVisual
          uri={uri}
          failed={Boolean(failed)}
          loading={loading}
          member={member}
          name={name}
          label={label}
          size={size}
          onImageError={() => uri && setFailedUri(uri)}
        />
      </View>
      {failed && retryable && path ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={getTranslation(language)('leagues.retry', { label })}
          onPress={retry}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
            {getTranslation(language)('leagues.retryPicture')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function LeagueAvatarVisual({
  uri,
  failed,
  loading,
  member,
  name,
  label,
  size,
  onImageError,
}: Readonly<{
  uri?: string;
  failed: boolean;
  loading: boolean;
  member: boolean;
  name: string;
  label: string;
  size: number;
  onImageError: () => void;
}>) {
  const language = useLanguage();
  const p = usePalette();
  let picture;
  if (uri && !failed) {
    picture = (
      <Image
        accessibilityLabel={label}
        source={{ uri }}
        onError={onImageError}
        style={{ width: '100%', height: '100%' }}
      />
    );
  } else if (loading) {
    picture = (
      <ActivityIndicator
        accessibilityLabel={getTranslation(language)('leagues.loading', { label })}
        color={p['brand-ink']}
      />
    );
  } else if (member) {
    picture = (
      <Text
        accessibilityLabel={getTranslation(language)('leagues.profilePictureUnavailable', { name })}
        style={[textStyles.label, { color: p['brand-ink'] }]}
      >
        {name.slice(0, 1).toUpperCase()}
      </Text>
    );
  } else {
    picture = (
      <Ionicons
        accessibilityLabel={getTranslation(language)('leagues.defaultLeaguePicture')}
        name="trophy-outline"
        size={size > 64 ? 40 : 24}
        color={p['brand-ink']}
      />
    );
  }
  return picture;
}
