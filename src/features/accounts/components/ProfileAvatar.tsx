import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { getProfilePicture } from '../api';
import { profilePicturePath, type Account } from '../schemas';
import { SetupButton } from './SetupUI';

export function ProfileAvatar({ account, preview }: { account: Account; preview?: string }) {
  const p = usePalette();
  const [decoded, setDecoded] = useState<{ blob: Blob; uri?: string; failed?: boolean }>();
  const privatePhoto = account.profile.picture_url === profilePicturePath && !preview;
  const photo = useQuery({
    queryKey: ['accounts', account.id, 'picture', account.profile.updated_at],
    queryFn: ({ signal }) => getProfilePicture(signal),
    enabled: privatePhoto,
    gcTime: 0,
    retry: false,
  });
  useEffect(() => {
    if (!photo.data || !privatePhoto) return;
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
  }, [photo.data, privatePhoto, account.id]);
  const uri =
    preview ||
    (privatePhoto
      ? decoded?.blob === photo.data
        ? decoded?.uri
        : undefined
      : account.profile.picture_url);
  const failed = photo.isError || (decoded?.blob === photo.data && decoded?.failed);
  return (
    <View style={{ alignItems: 'center', gap: spacing['space-2'] }}>
      <View
        style={{
          width: 112,
          height: 112,
          borderRadius: radii['radius-pill'],
          backgroundColor: p['brand-soft'],
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {uri ? (
          <Image
            accessibilityLabel="Profile picture"
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
          />
        ) : privatePhoto && (photo.isPending || (!failed && !uri)) ? (
          <ActivityIndicator accessibilityLabel="Loading profile picture" color={p['brand-ink']} />
        ) : (
          <Text
            accessibilityLabel="No profile picture"
            style={[textStyles['display-lg'], { color: p['brand-ink'] }]}
          >
            {account.profile.display_name?.slice(0, 1).toUpperCase() || '+'}
          </Text>
        )}
      </View>
      {privatePhoto && failed ? (
        <>
          <Text accessibilityRole="alert" style={{ color: p.danger }}>
            Could not load your picture.
          </Text>
          <SetupButton
            title="Retry picture"
            secondary
            onPress={() => {
              void photo.refetch();
            }}
          />
        </>
      ) : null}
    </View>
  );
}
