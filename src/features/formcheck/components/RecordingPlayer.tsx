import React from 'react';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Text, View } from 'react-native';
import { radii, textStyles, usePalette } from '@/theme/tokens';
import { FormCheckScreen } from './FormCheckScreen';

/** Plays the user's own recording. The file can be gone, so a failed load says so. */
export function RecordingPlayer({
  uri,
  title,
  onBack,
}: Readonly<{
  uri: string;
  title: string;
  onBack: () => void;
}>) {
  const p = usePalette();
  const player = useVideoPlayer(uri, (value) => {
    value.loop = false;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  return (
    <FormCheckScreen
      overline={title.toUpperCase()}
      title="Your recording"
      backLabel="Back to analysis"
      onBack={onBack}
      scroll={false}
    >
      {status === 'error' ? (
        <Text accessibilityRole="alert" style={[textStyles.body, { color: p['ink-muted'] }]}>
          This recording is no longer available.
        </Text>
      ) : (
        <View
          style={{
            flex: 1,
            borderRadius: radii['radius-xl'],
            overflow: 'hidden',
            backgroundColor: p['surface-300'],
          }}
        >
          <VideoView
            player={player}
            style={{ flex: 1 }}
            contentFit="contain"
            nativeControls
            accessibilityLabel="Recorded set"
          />
        </View>
      )}
    </FormCheckScreen>
  );
}
