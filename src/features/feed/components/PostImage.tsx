import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton } from '@/features/training/components/ui';
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
  const [expanded, setExpanded] = useState(false);
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
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${label}`}
          onPress={() => setExpanded(true)}
          style={StyleSheet.absoluteFill}
        >
          <Image
            accessibilityLabel={label}
            source={{ uri: image.data }}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
          />
        </Pressable>
        {expanded ? (
          <PhotoViewer uri={image.data} label={label} onClose={() => setExpanded(false)} />
        ) : null}
      </>
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

function PhotoViewer({
  uri,
  label,
  onClose,
}: Readonly<{ uri: string; label: string; onClose: () => void }>) {
  const p = usePalette();
  return (
    <Modal animationType="fade" onRequestClose={onClose}>
      <SafeAreaView
        accessibilityViewIsModal
        style={[styles.viewer, { backgroundColor: p['surface-100'] }]}
      >
        <View style={styles.viewerHeader}>
          <IconButton icon="x" label="Close photo" onPress={onClose} />
        </View>
        <Image
          accessibilityLabel={`Enlarged ${label}`}
          source={{ uri }}
          resizeMode="contain"
          style={styles.fullPhoto}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewer: { flex: 1, padding: spacing['space-3'], gap: spacing['space-2'] },
  viewerHeader: { alignItems: 'flex-end' },
  fullPhoto: { flex: 1, width: '100%' },
  frame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  retry: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['space-2'],
    padding: spacing['space-4'],
    minHeight: 44,
  },
});
