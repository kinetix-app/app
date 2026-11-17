import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { leaguesApi } from '../api';

export function LeagueAvatar({
  accountId,
  path,
  name,
  member = false,
  size = 44,
  preview,
  retryable = false,
}: Readonly<{
  accountId: number;
  path?: string | null;
  name: string;
  member?: boolean;
  size?: number;
  preview?: string;
  retryable?: boolean;
}>) {
  const p = usePalette();
  const [decoded, setDecoded] = useState<{ blob: Blob; uri?: string; failed?: boolean }>();
  const [failedUri, setFailedUri] = useState<string>();
  const privatePhoto = Boolean(path?.startsWith('/api/v1/leagues/'));
  const photo = useQuery({
    queryKey: ['leagues', accountId, 'picture', path],
    queryFn: ({ signal }) => leaguesApi.picture(path!, signal),
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
  const uri =
    preview ??
    (privatePhoto
      ? decoded?.blob === photo.data
        ? decoded?.uri
        : undefined
      : (path ?? undefined));
  const failed =
    photo.isError ||
    (decoded?.blob === photo.data && decoded?.failed) ||
    (uri && failedUri === uri);
  const label = `${name} ${member ? 'profile' : 'league'} picture`;
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
        {uri && !failed ? (
          <Image
            accessibilityLabel={label}
            source={{ uri }}
            onError={() => setFailedUri(uri)}
            style={{ width: '100%', height: '100%' }}
          />
        ) : privatePhoto && !preview && !failed ? (
          <ActivityIndicator accessibilityLabel={`Loading ${label}`} color={p['brand-ink']} />
        ) : member ? (
          <Text
            accessibilityLabel={`${name} profile picture unavailable`}
            style={[textStyles.label, { color: p['brand-ink'] }]}
          >
            {name.slice(0, 1).toUpperCase()}
          </Text>
        ) : (
          <Ionicons
            accessibilityLabel="Default league picture"
            name="trophy-outline"
            size={size > 64 ? 40 : 24}
            color={p['brand-ink']}
          />
        )}
      </View>
      {failed && retryable && path ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Retry ${label}`}
          onPress={() => {
            setFailedUri(undefined);
            void photo.refetch();
          }}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={[textStyles.label, { color: p['brand-ink'] }]}>Retry picture</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
