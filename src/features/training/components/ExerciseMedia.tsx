import { getTranslation } from '@/i18n/catalog';
import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/i18n/Language';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { Image, Text, View } from 'react-native';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { IconButton, Loading } from './ui';

const mediaStyle = { height: 240, width: '100%' as const, borderRadius: 20 };

type Props = Readonly<{ name: string; videoUrl: string | null; imageUrl: string | null }>;

export function ExerciseMedia({ name, videoUrl, imageUrl }: Props) {
  if (videoUrl)
    return <ExerciseVideo key={videoUrl} name={name} url={videoUrl} imageUrl={imageUrl} />;
  if (imageUrl)
    return (
      <Image
        source={{ uri: imageUrl }}
        style={mediaStyle}
        resizeMode="contain"
        accessibilityLabel={name}
      />
    );
  return null;
}

// Expo Video exposes mutable native player properties rather than a mute method.
function setPlayerMuted(player: VideoPlayer, value: boolean) {
  player.muted = value;
}

function ExerciseVideo({
  name,
  url,
  imageUrl,
}: Readonly<{
  name: string;
  url: string;
  imageUrl: string | null;
}>) {
  const p = usePalette();
  const language = useLanguage();
  const es = language === 'es';
  const view = useRef<VideoView>(null);
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(url, (player) => {
    player.muted = true;
    player.loop = true;
    player.timeUpdateEventInterval = 0.25;
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const autoplayed = useRef(false);
  useEffect(() => {
    // Web attaches its video element after the player setup callback has run.
    if (status === 'readyToPlay' && !autoplayed.current) {
      autoplayed.current = true;
      player.play();
    }
  }, [player, status]);
  if (status === 'error')
    return (
      <View style={{ gap: 12 }}>
        <Text accessibilityRole="alert" style={{ color: p['ink-muted'] }}>
          {getTranslation(es)('training.videoUnavailable_af9b60')}
        </Text>
        <ExerciseMedia name={name} videoUrl={null} imageUrl={imageUrl} />
      </View>
    );
  return (
    <View
      style={{
        backgroundColor: p['surface-200'],
        borderRadius: radii['radius-lg'],
        overflow: 'hidden',
      }}
    >
      <VideoView
        ref={view}
        player={player}
        style={mediaStyle}
        contentFit="contain"
        nativeControls={false}
        accessibilityLabel={getTranslation(es)('dynamicMessages.videoFor_47fd4e', {
          value1: name,
        })}
      />
      {status === 'loading' ? <Loading /> : null}
      <VideoControls
        player={player}
        view={view}
        isPlaying={isPlaying}
        muted={muted}
        setMuted={setMuted}
        currentTime={currentTime}
      />
    </View>
  );
}

function VideoControls({
  player,
  view,
  isPlaying,
  muted,
  setMuted,
  currentTime,
}: Readonly<{
  player: VideoPlayer;
  view: React.RefObject<VideoView | null>;
  isPlaying: boolean;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  currentTime: number;
}>) {
  const p = usePalette();
  const language = useLanguage();
  const es = language === 'es';
  const clock = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const progress = player.duration ? (currentTime / player.duration) * 100 : 0;
  const playingLabel = isPlaying
    ? { en: 'Pause video', es: 'Pausar vídeo' }
    : { en: 'Play video', es: 'Reproducir vídeo' };
  const soundLabel = muted
    ? { en: 'Unmute video', es: 'Activar sonido' }
    : { en: 'Mute video', es: 'Silenciar vídeo' };
  return (
    <View style={{ padding: spacing['space-3'], gap: spacing['space-2'] }}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={getTranslation(es)('training.videoProgress_205c89')}
        accessibilityValue={{ min: 0, max: player.duration || 1, now: currentTime }}
        style={{ height: 4, borderRadius: radii['radius-pill'], backgroundColor: p['surface-300'] }}
      >
        <View
          style={{
            height: 4,
            borderRadius: radii['radius-pill'],
            backgroundColor: p.brand,
            width: `${Math.min(100, progress)}%`,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['space-2'] }}>
        <IconButton
          icon={isPlaying ? 'pause' : 'play'}
          label={playingLabel[language]}
          onPress={() => (isPlaying ? player.pause() : player.play())}
        />
        <IconButton
          icon="rotate-ccw"
          label={getTranslation(es)('training.replayVideo_70b744')}
          onPress={() => player.replay()}
        />
        <Text
          style={[
            textStyles['body-sm'],
            { flex: 1, color: p['ink-muted'], fontVariant: ['tabular-nums'] },
          ]}
        >
          {clock(currentTime)} / {clock(player.duration || 0)}
        </Text>
        <IconButton
          icon={muted ? 'volume-x' : 'volume-2'}
          label={soundLabel[language]}
          onPress={() => {
            setPlayerMuted(player, !muted);
            setMuted(!muted);
          }}
        />
        <IconButton
          icon="maximize"
          label={getTranslation(es)('training.fullScreenVideo_e239c9')}
          onPress={() => void view.current?.enterFullscreen()}
        />
      </View>
    </View>
  );
}
