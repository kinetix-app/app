import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { Image, View } from 'react-native';
import { InitialAvatar } from '@/components/InitialAvatar';
import { blobToDataUri } from '@/services/blob';
import { radii } from '@/theme/tokens';
import { friendsApi, friendsKey } from '../api';

type AvatarPerson = Readonly<{ id: number; display_name: string | null; has_picture?: boolean }>;

/** Another person's photo when they have one; their initial while loading or on failure. */
export function PersonAvatar({
  accountId,
  person,
  size = 40,
}: Readonly<{ accountId: number; person: AvatarPerson; size?: number }>) {
  const picture = useQuery({
    queryKey: [...friendsKey(accountId), 'picture', person.id],
    queryFn: async ({ signal }) => blobToDataUri(await friendsApi.picture(person.id, signal)),
    enabled: Boolean(person.has_picture),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });
  if (!person.has_picture || !picture.data)
    return <InitialAvatar name={person.display_name} size={size} />;
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ width: size, height: size, borderRadius: radii['radius-pill'], overflow: 'hidden' }}
    >
      <Image source={{ uri: picture.data }} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
