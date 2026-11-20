import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { feedApi } from '../api';
import { blobToDataUri } from '../format';

/** Post photos are private API resources: fetched with auth, then shown as data URIs. */
export function PostImage({
  accountId,
  path,
  label,
  style,
}: Readonly<{ accountId: number; path: string; label: string; style?: StyleProp<ViewStyle> }>) {
  const p = usePalette();
  const image = useQuery({
    queryKey: ['feed', accountId, 'media', path],
    queryFn: async ({ signal }) => blobToDataUri(await feedApi.media(path, signal)),
    // Blob names are never reused, so a loaded photo stays valid while the feed is open.
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  });
  let content: React.ReactNode;
  if (image.data)
    content = (
      <Image
        accessibilityLabel={label}
        source={{ uri: image.data }}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
      />
    );
  else if (image.isError)
    content = (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Retry loading ${label}`}
        onPress={() => {
          void image.refetch();
        }}
        style={styles.retry}
      >
        <Feather name="image" size={28} color={p['ink-muted']} />
        <Text style={[textStyles['body-sm'], { color: p.ink, textAlign: 'center' }]}>
          Could not load photo. Tap to retry.
        </Text>
      </Pressable>
    );
  else content = <ActivityIndicator accessibilityLabel={`Loading ${label}`} color={p.brand} />;
  return (
    <View style={[styles.frame, { backgroundColor: p['surface-300'] }, style]}>{content}</View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  retry: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['space-2'],
    padding: spacing['space-4'],
    minHeight: 44,
  },
});
