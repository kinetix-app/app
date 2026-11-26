import React, { useEffect, useState } from 'react';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Text, View } from 'react-native';
import { selectCopy, useLanguage } from '@/i18n/Language';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { Button } from '@/features/training/components/ui';
import { containRect } from '../poseTrack';
import type { PoseTrack } from '../schemas';
import { FormCheckScreen } from './FormCheckScreen';
import { PoseOverlay } from './PoseOverlay';

function RecordingFooter({
  showJoints,
  hasFaults,
  onToggle,
}: Readonly<{
  showJoints: boolean;
  hasFaults: boolean;
  onToggle: () => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const toggleTitle = jointToggleTitle(showJoints, es);
  return (
    <>
      {showJoints && hasFaults ? (
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {selectCopy(
            es,
            'Las articulaciones se vuelven rojas durante una repetición con un fallo en esa zona.',
            'Joints turn red during a rep with a fault there.',
          )}
        </Text>
      ) : null}
      <Button
        title={toggleTitle}
        icon={showJoints ? 'eye-off' : 'eye'}
        secondary
        onPress={onToggle}
      />
    </>
  );
}

function jointToggleTitle(showJoints: boolean, es: boolean) {
  if (showJoints) return selectCopy(es, 'Ocultar articulaciones', 'Hide joints');
  return selectCopy(es, 'Mostrar articulaciones', 'Show joints');
}

function unavailableMessage(es: boolean) {
  if (es) return 'Esta grabación ya no está disponible.';
  return 'This recording is no longer available.';
}

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
  const es = useLanguage() === 'es';
  const player = useVideoPlayer(uri, (value) => {
    value.loop = false;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [showJoints, setShowJoints] = useState(true);
  // The skeleton follows the video on every screen refresh, not only on the player's time events.
  const [currentTime, setCurrentTime] = useState(0);
  const tracking = Boolean(pose) && showJoints;
  useEffect(() => {
    if (!tracking) return;
    let frameId = 0;
    const tick = () => {
      const time = player.currentTime;
      if (typeof time === 'number')
        setCurrentTime((previous) => (previous === time ? previous : time));
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [player, tracking]);
  const frame = getRecordingFrame(pose, box);
  const hasFaults = pose?.reps.some((rep) => rep.faultJoints.length > 0) ?? false;

  const videoMessage = status === 'error' ? unavailableMessage(es) : null;

  return (
    <FormCheckScreen
      overline={title.toUpperCase()}
      title={selectCopy(es, 'Tu grabación', 'Your recording')}
      backLabel={selectCopy(es, 'Volver al análisis', 'Back to analysis')}
      onBack={onBack}
      scroll={false}
      footer={
        pose && status !== 'error' ? (
          <RecordingFooter
            showJoints={showJoints}
            hasFaults={hasFaults}
            onToggle={() => setShowJoints((value) => !value)}
          />
        ) : undefined
      }
    >
      {videoMessage ? (
        <Text accessibilityRole="alert" style={[textStyles.body, { color: p['ink-muted'] }]}>
          {videoMessage}
        </Text>
      ) : (
        <View
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setBox({ width, height });
          }}
          style={{
            flex: 1,
            minHeight: 0,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radii['radius-xl'],
            overflow: 'hidden',
            backgroundColor: p['surface-300'],
            marginBottom: pose ? spacing['space-2'] : 0,
          }}
        >
          {/* With poses, the video gets a box of its exact shape so the joints share its frame. */}
          <View
            style={
              frame
                ? { width: frame.width, height: frame.height }
                : { flex: 1, alignSelf: 'stretch' }
            }
          >
            <VideoView
              player={player}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
              nativeControls
              accessibilityLabel={selectCopy(es, 'Serie grabada', 'Recorded set')}
            />
            {pose && frame && showJoints ? (
              <PoseOverlay track={pose} time={currentTime} box={frame} />
            ) : null}
          </View>
        </View>
      )}
    </FormCheckScreen>
  );
}

function getRecordingFrame(pose: PoseTrack | undefined, box: { width: number; height: number }) {
  if (!pose || !box.width || !box.height) return null;
  return containRect(box, pose.width, pose.height);
}
