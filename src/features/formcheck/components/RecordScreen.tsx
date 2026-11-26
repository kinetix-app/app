import type { ViewInstance } from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { selectCopy, useLanguage } from '@/i18n/Language';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { Button, ui } from '@/features/training/components/ui';
import type { FormCheckProfile } from '../profiles';
import type { Recording } from '../schemas';
import { createCameraRecorder, type CameraRecorder } from '../webRecorder';
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
}: Readonly<{
  profile: FormCheckProfile;
  exerciseName: string;
  setNumber: number;
  onCancel: () => void;
  onFinish: (recording: Recording) => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const camera = useRef<CameraView>(null);
  const frame = useRef<ViewInstance>(null);
  const [webRecorder, setWebRecorder] = useState<CameraRecorder | null>(null);
  const capture = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const cancelled = useRef(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [failed, setFailed] = useState(false);
  // expo-camera cannot record on the web: there the preview's stream is recorded by the browser.
  const isWeb = Platform.OS === 'web';
  const canKeepVideo = !isWeb || webRecorder !== null;

  useEffect(() => {
    if (!isWeb) return;
    const recorder = createCameraRecorder(frame.current);
    setWebRecorder(recorder);
    return () => {
      void recorder?.stop().then((uri) => {
        if (uri) URL.revokeObjectURL(uri);
      });
    };
  }, [isWeb]);

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
    if (isWeb) {
      webRecorder?.start();
      return;
    }
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
    if (isWeb) {
      const uri = (await webRecorder?.stop()) ?? null;
      if (cancelled.current) return;
      if (!uri) {
        setFailed(true);
        return;
      }
      onFinish({ uri, durationSeconds: duration });
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
  /** Development only: analyze an existing video instead of recording one. */
  async function pickVideo() {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'] });
    const asset = picked.canceled ? undefined : picked.assets[0];
    if (!asset || cancelled.current) return;
    onFinish({ uri: asset.uri, durationSeconds: Math.round((asset.duration ?? 0) / 1000) });
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
      overline={`${exerciseName.toUpperCase()} · ${selectCopy(es, 'SERIE', 'SET')} ${setNumber}`}
      title={selectCopy(es, 'Graba tu serie', 'Record your set')}
      backIcon="x"
      backLabel={selectCopy(es, 'Cancelar grabación', 'Cancel recording')}
      onBack={onCancel}
      scroll={false}
      footer={
        recording ? (
          <>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              {selectCopy(
                es,
                'Haz tu serie como siempre. Detén la grabación al terminar.',
                'Do your set as usual. Stop when you finish.',
              )}
            </Text>
            <Button
              title={selectCopy(es, 'Detener y analizar', 'Stop and analyze')}
              onPress={() => void stop()}
            />
          </>
        ) : (
          <>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              {es
                ? ((
                    {
                      'back-squat':
                        'Coloca el teléfono a la altura de la cadera, a 2–3 m de lado, con todo el cuerpo en el encuadre.',
                      'push-up':
                        'Coloca el teléfono en el suelo a 2 m de lado, con todo el cuerpo en el encuadre.',
                      'hammer-curl':
                        'Coloca el teléfono a 2 m de lado, con el brazo que trabaja hacia él y desde el hombro hasta la cadera en el encuadre.',
                      'seated-shoulder-press':
                        'Coloca el teléfono a 2 m de lado y a la altura del pecho, con los brazos extendidos dentro del encuadre.',
                      'dumbbell-row':
                        'Coloca el teléfono a 2 m de lado, con el brazo que trabaja hacia él y todo el cuerpo en el encuadre.',
                    } as Record<string, string>
                  )[profile.id] ?? profile.camera.hint)
                : profile.camera.hint}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-2'] }}>
              {profile.camera.checklist.map((item) => (
                <View key={item} style={chip}>
                  <Text style={[textStyles.caption, { color: p.ink }]}>
                    {es
                      ? ((
                          {
                            'Full body': 'Cuerpo entero',
                            'Side view': 'Vista lateral',
                            'Good light': 'Buena luz',
                            'Working arm toward the phone': 'Brazo que trabaja hacia el teléfono',
                            'Arms in the frame': 'Brazos en el encuadre',
                          } as Record<string, string>
                        )[item] ?? item)
                      : item}
                  </Text>
                </View>
              ))}
            </View>
            {failed ? (
              <Text accessibilityRole="alert" style={{ color: p.danger }}>
                {selectCopy(
                  es,
                  'No se pudo guardar la grabación. Inténtalo de nuevo.',
                  'The recording could not be saved. Try again.',
                )}
              </Text>
            ) : null}
            <Button
              title={selectCopy(es, 'Iniciar grabación', 'Start recording')}
              icon="video"
              onPress={start}
            />
            {__DEV__ ? (
              <Button
                title={selectCopy(es, 'Usar un vídeo', 'Use a video')}
                icon="upload"
                secondary
                accessibilityLabel={selectCopy(
                  es,
                  'Analizar un archivo de vídeo (solo desarrollo)',
                  'Analyze a video file (development only)',
                )}
                onPress={() => void pickVideo()}
              />
            ) : null}
          </>
        )
      }
    >
      <View
        ref={frame}
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
          accessibilityLabel={selectCopy(es, 'Vista previa de la cámara', 'Camera preview')}
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
              {selectCopy(es, 'Grabando', 'Recording')} · {clock(seconds)}
            </Text>
          </View>
        ) : null}
      </View>
    </FormCheckScreen>
  );
}
