import React, { useEffect, useRef, useState } from 'react';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { Image, Text, View } from 'react-native';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { IconButton, Loading } from './ui';

const mediaStyle = { height: 240, width: '100%' as const, borderRadius: 20 };

type Props = { name: string; videoUrl: string | null; imageUrl: string | null };

export function ExerciseMedia({ name, videoUrl, imageUrl }: Props) {
  return videoUrl ? (
    <ExerciseVideo key={videoUrl} name={name} url={videoUrl} imageUrl={imageUrl} />
  ) : imageUrl ? (
    <Image
      source={{ uri: imageUrl }}
      style={mediaStyle}
      resizeMode="contain"
      accessibilityLabel={name}
    />
  ) : null;
}

// Expo Video exposes mutable native player properties rather than a mute method.
function setPlayerMuted(player: VideoPlayer, value: boolean) {
  player.muted = value;
}

function ExerciseVideo({
  name,
  url,
  imageUrl,
}: {
  name: string;
  url: string;
  imageUrl: string | null;
}) {
  const p = usePalette();
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
  const clock = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
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
          Video unavailable.
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
        accessibilityLabel={`Video for ${name}`}
      />
      {status === 'loading' ? <Loading /> : null}
      <View style={{ padding: spacing['space-3'], gap: spacing['space-2'] }}>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Video progress"
          accessibilityValue={{ min: 0, max: player.duration || 1, now: currentTime }}
          style={{
            height: 4,
            borderRadius: radii['radius-pill'],
            backgroundColor: p['surface-300'],
          }}
        >
          <View
            style={{
              height: 4,
              borderRadius: radii['radius-pill'],
              backgroundColor: p.brand,
              width: `${Math.min(100, player.duration ? (currentTime / player.duration) * 100 : 0)}%`,
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['space-2'] }}>
          <IconButton
            icon={isPlaying ? 'pause' : 'play'}
            label={isPlaying ? 'Pause video' : 'Play video'}
            onPress={() => {
              if (isPlaying) player.pause();
              else player.play();
            }}
          />
          <IconButton
            icon="rotate-ccw"
            label="Replay video"
            onPress={() => {
              player.replay();
            }}
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
            label={muted ? 'Unmute video' : 'Mute video'}
            onPress={() => {
              setPlayerMuted(player, !muted);
              setMuted(!muted);
            }}
          />
          <IconButton
            icon="maximize"
            label="Full screen video"
            onPress={() => {
              void view.current?.enterFullscreen();
            }}
          />
        </View>
      </View>
    </View>
  );
}
