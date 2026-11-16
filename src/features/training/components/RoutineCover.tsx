import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { radii, spacing, usePalette } from '@/theme/tokens';
import { trainingApi } from '../api';

export function RoutineCover({
  accountId,
  routineId,
  path,
  preview,
  size = 64,
  onOpen,
  openLabel,
  disabled = false,
}: Readonly<{
  accountId: number;
  routineId?: number;
  path?: string | null;
  preview?: string;
  size?: number;
  onOpen?: () => void;
  openLabel?: string;
  disabled?: boolean;
}>) {
  const p = usePalette();
  const [decoded, setDecoded] = useState<{ blob: Blob; uri?: string; failed?: boolean }>();
  const [failedUri, setFailedUri] = useState<string>();
  const picture = useQuery({
    queryKey: ['training', accountId, 'routine-picture', routineId, path],
    queryFn: ({ signal }) => {
      if (!path) throw new Error('Routine cover path is missing');
      return trainingApi.picture(path, signal);
    },
    enabled: Boolean(path) && !preview,
    gcTime: 0,
    retry: false,
  });
  useEffect(() => {
    if (!picture.data || !path || preview) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setDecoded({ blob: picture.data, uri: reader.result });
    };
    reader.onerror = () => setDecoded({ blob: picture.data, failed: true });
    reader.readAsDataURL(picture.data);
    return () => {
      reader.onload = null;
      reader.onerror = null;
      if (reader.readyState === FileReader.LOADING) reader.abort();
    };
  }, [picture.data, path, preview]);
  const uri = preview ?? (path && decoded?.blob === picture.data ? decoded?.uri : undefined);
  const failed =
    picture.isError ||
    (decoded?.blob === picture.data && decoded?.failed) ||
    (uri && failedUri === uri);
  let content = (
    <MaterialCommunityIcons
      accessibilityLabel="Gym routine"
      name="dumbbell"
      size={28}
      color={p['brand-ink']}
    />
  );
  if (uri && !failed)
    content = (
      <Image
        accessibilityLabel="Routine cover"
        source={{ uri }}
        onError={() => setFailedUri(uri)}
        style={{ width: '100%', height: '100%' }}
      />
    );
  else if (path && !preview && !failed)
    content = (
      <ActivityIndicator accessibilityLabel="Loading routine cover" color={p['brand-ink']} />
    );
  const retryVisible = Boolean(failed && path && !preview);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii['radius-md'],
        overflow: 'hidden',
        backgroundColor: p['brand-soft'],
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {content}
      {retryVisible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry routine cover"
          disabled={disabled}
          accessibilityState={{ disabled }}
          onPress={() => {
            setFailedUri(undefined);
            void picture.refetch();
          }}
          style={{
            position: 'absolute',
            inset: 0,
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing['space-2'],
            backgroundColor: p['surface-300'],
          }}
        >
          <Feather name="refresh-cw" size={20} color={p.ink} />
        </Pressable>
      ) : null}
      {!retryVisible && onOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={openLabel}
          disabled={disabled}
          accessibilityState={{ disabled }}
          onPress={onOpen}
          style={{ position: 'absolute', inset: 0 }}
        />
      ) : null}
    </View>
  );
}
