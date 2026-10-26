import React, { useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { CameraView } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { Button, ui } from '@/features/training/components/ui';
import type { FormCheckProfile } from '../profiles';
import type { Recording } from '../schemas';
import { FormCheckScreen } from './FormCheckScreen';

const MAX_SECONDS = 180;
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * Camera preview with start and stop. Browsers cannot record through the camera component, so
 * there the set is timed without keeping a video (the result then has no recording to watch).
 */
export function RecordScreen({
  profile,
  exerciseName,
  setNumber,
  onCancel,
  onFinish,
}: {
  profile: FormCheckProfile;
  exerciseName: string;
  setNumber: number;
  onCancel: () => void;
  onFinish: (recording: Recording) => void;
}) {
  const p = usePalette();
  const camera = useRef<CameraView>(null);
  const capture = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const cancelled = useRef(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [failed, setFailed] = useState(false);
  const canKeepVideo = Platform.OS !== 'web';

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    cancelled.current = false;
    const cameraView = camera.current;
    return () => {
      cancelled.current = true;
      if (capture.current) cameraView?.stopRecording();
    };
  }, []);

  function start() {
    setFailed(false);
    setSeconds(0);
    setRecording(true);
    if (!canKeepVideo) return;
    // Audio is not recorded: the form check only needs the picture.
    capture.current = (
      camera.current?.recordAsync({ maxDuration: MAX_SECONDS }) ?? Promise.resolve(undefined)
    ).catch(() => undefined);
  }
  async function stop() {
    const duration = seconds;
    setRecording(false);
    if (!canKeepVideo) {
      onFinish({ uri: null, durationSeconds: duration });
      return;
    }
    camera.current?.stopRecording();
    const video = await capture.current;
    capture.current = null;
    if (cancelled.current) return;
    if (!video) {
      setFailed(true);
      return;
    }
    onFinish({ uri: video.uri, durationSeconds: duration });
  }
  const chip = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing['space-1'],
    paddingHorizontal: spacing['space-3'],
    paddingVertical: spacing['space-2'],
    borderRadius: radii['radius-pill'],
    backgroundColor: p['surface-300'],
  };
  return (
    <FormCheckScreen
      overline={`${exerciseName.toUpperCase()} · SET ${setNumber}`}
      title="Record your set"
      backIcon="x"
      backLabel="Cancel recording"
      onBack={onCancel}
      scroll={false}
      footer={
        recording ? (
          <>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              Do your set as usual. Stop when you finish.
            </Text>
            <Button title="Stop and analyze" onPress={() => void stop()} />
          </>
        ) : (
          <>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              {profile.camera.hint}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-2'] }}>
              {profile.camera.checklist.map((item) => (
                <View key={item} style={chip}>
                  <Text style={[textStyles.caption, { color: p.ink }]}>{item}</Text>
                </View>
              ))}
            </View>
            {failed ? (
              <Text accessibilityRole="alert" style={{ color: p.danger }}>
                The recording could not be saved. Try again.
              </Text>
            ) : null}
            <Button title="Start recording" icon="video" onPress={start} />
          </>
        )
      }
    >
      <View
        style={{
          flex: 1,
          borderRadius: radii['radius-xl'],
          overflow: 'hidden',
          backgroundColor: p['surface-300'],
        }}
      >
        <CameraView
          ref={camera}
          style={{ flex: 1 }}
          facing="back"
          mode="video"
          mute
          accessibilityLabel="Camera preview"
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: spacing['space-6'],
            bottom: spacing['space-6'],
            left: spacing['space-12'],
            right: spacing['space-12'],
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: p.brand,
            borderRadius: radii['radius-lg'],
          }}
        />
        {recording ? (
          <View
            accessibilityRole="timer"
            style={[
              ui.row,
              {
                position: 'absolute',
                top: spacing['space-4'],
                left: spacing['space-4'],
                paddingHorizontal: spacing['space-3'],
                paddingVertical: spacing['space-2'],
                borderRadius: radii['radius-pill'],
                backgroundColor: p['surface-200'],
                gap: spacing['space-2'],
              },
            ]}
          >
            <Feather name="circle" size={10} color={p.danger} />
            <Text style={[textStyles.label, { color: p.ink, fontVariant: ['tabular-nums'] }]}>
              Recording · {clock(seconds)}
            </Text>
          </View>
        ) : null}
      </View>
    </FormCheckScreen>
  );
}
