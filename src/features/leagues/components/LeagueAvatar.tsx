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
  const p = usePalette();
  const { uri, failed, loading, setFailedUri, retry } = useLeaguePhoto(
    accountId,
    path,
    preview,
    invitationToken,
  );
  const label = `${name} ${member ? 'profile' : 'league'} picture`;
  let picture;
  if (uri && !failed) {
    picture = (
      <Image
        accessibilityLabel={label}
        source={{ uri }}
        onError={() => setFailedUri(uri)}
        style={{ width: '100%', height: '100%' }}
      />
    );
  } else if (loading) {
    picture = <ActivityIndicator accessibilityLabel={`Loading ${label}`} color={p['brand-ink']} />;
  } else if (member) {
    picture = (
      <Text
        accessibilityLabel={`${name} profile picture unavailable`}
        style={[textStyles.label, { color: p['brand-ink'] }]}
      >
        {name.slice(0, 1).toUpperCase()}
      </Text>
    );
  } else {
    picture = (
      <Ionicons
        accessibilityLabel="Default league picture"
        name="trophy-outline"
        size={size > 64 ? 40 : 24}
        color={p['brand-ink']}
      />
    );
  }
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
        {picture}
      </View>
      {failed && retryable && path ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Retry ${label}`}
          onPress={retry}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={[textStyles.label, { color: p['brand-ink'] }]}>Retry picture</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
