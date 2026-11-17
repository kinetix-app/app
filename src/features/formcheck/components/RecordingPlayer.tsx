import React, { useState } from 'react';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Text, View } from 'react-native';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { Button } from '@/features/training/components/ui';
import type { PoseTrack } from '../schemas';
import { FormCheckScreen } from './FormCheckScreen';
import { PoseOverlay } from './PoseOverlay';

/** Skeleton refresh rate; the analysis samples poses at 15 fps. */
const OVERLAY_FPS = 15;

/**
 * Plays the user's own recording, with the joints the analysis tracked drawn on top when they
 * are available. The file can be gone, so a failed load says so.
 */
export function RecordingPlayer({
  uri,
  title,
  pose,
  onBack,
}: Readonly<{
  uri: string;
  title: string;
  pose?: PoseTrack;
  onBack: () => void;
}>) {
  const p = usePalette();
  const player = useVideoPlayer(uri, (value) => {
    value.loop = false;
    value.timeUpdateEventInterval = 1 / OVERLAY_FPS;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [showJoints, setShowJoints] = useState(true);
  const hasFaults = pose?.reps.some((rep) => rep.faultJoints.length > 0) ?? false;

  return (
    <FormCheckScreen
      overline={title.toUpperCase()}
      title="Your recording"
      backLabel="Back to analysis"
      onBack={onBack}
      scroll={false}
      footer={
        pose && status !== 'error' ? (
          <>
            {showJoints && hasFaults ? (
              <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                Joints turn red during a rep with a fault there.
              </Text>
            ) : null}
            <Button
              title={showJoints ? 'Hide joints' : 'Show joints'}
              icon={showJoints ? 'eye-off' : 'eye'}
              secondary
              onPress={() => setShowJoints((value) => !value)}
            />
          </>
        ) : undefined
      }
    >
      {status === 'error' ? (
        <Text accessibilityRole="alert" style={[textStyles.body, { color: p['ink-muted'] }]}>
          This recording is no longer available.
        </Text>
      ) : (
        <View
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setBox({ width, height });
          }}
          style={{
            flex: 1,
            borderRadius: radii['radius-xl'],
            overflow: 'hidden',
            backgroundColor: p['surface-300'],
            marginBottom: pose ? spacing['space-2'] : 0,
          }}
        >
          <VideoView
            player={player}
            style={{ flex: 1 }}
            contentFit="contain"
            nativeControls
            accessibilityLabel="Recorded set"
          />
          {pose && showJoints ? <PoseOverlay track={pose} time={currentTime} box={box} /> : null}
        </View>
      )}
    </FormCheckScreen>
  );
}
