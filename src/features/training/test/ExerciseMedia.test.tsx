import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useEvent } from 'expo';
import { useVideoPlayer } from 'expo-video';
import { ExerciseMedia } from '../components/ExerciseMedia';
import { LanguageProvider } from '@/i18n/Language';

const mockEnterFullscreen = jest.fn();

jest.mock('expo', () => ({ useEvent: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Feather: 'Icon' }));
jest.mock('expo-video', () => {
  const ReactModule = jest.requireActual('react') as typeof React;
  const NativeView = jest.requireActual('react-native').View;
  return {
    useVideoPlayer: jest.fn(),
    VideoView: ReactModule.forwardRef(
      (
        props: React.ComponentProps<typeof NativeView>,
        ref: React.Ref<{ enterFullscreen: () => Promise<void> }>,
      ) => {
        ReactModule.useImperativeHandle(ref, () => ({ enterFullscreen: mockEnterFullscreen }));
        return ReactModule.createElement(NativeView, props);
      },
    ),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockEnterFullscreen.mockResolvedValue(undefined);
  jest.mocked(useVideoPlayer).mockImplementation((source, setup) => {
    const player = {
      status: 'readyToPlay',
      duration: 6,
      playing: true,
      play: jest.fn(),
      replay: jest.fn(),
      pause: jest.fn(),
    } as unknown as ReturnType<typeof useVideoPlayer>;
    setup?.(player);
    return player;
  });
  jest.mocked(useEvent).mockImplementation((_player, event) => {
    if (event === 'playingChange') return { isPlaying: true };
    if (event === 'timeUpdate') return { currentTime: 2 };
    return { status: 'readyToPlay' };
  });
});

const props = {
  name: 'Bench press',
  videoUrl: 'https://media.example/press.mp4',
  imageUrl: 'https://media.example/press.jpg',
};

test('prefers inline video over the image with playback controls', () => {
  render(<ExerciseMedia {...props} />);
  expect(useVideoPlayer).toHaveBeenCalledWith(props.videoUrl, expect.any(Function));
  const player = jest.mocked(useVideoPlayer).mock.results[0].value;
  expect(player.play).toHaveBeenCalled();
  expect(player.muted).toBe(true);
  expect(player.loop).toBe(true);
  expect(screen.getByLabelText('Video for Bench press').props.nativeControls).toBe(false);
  expect(screen.queryByLabelText('Bench press')).toBeNull();
});

test('falls back to the image when the exercise has no video', () => {
  render(<ExerciseMedia {...props} videoUrl={null} />);
  expect(screen.getByLabelText('Bench press').props.source).toEqual({ uri: props.imageUrl });
  expect(useVideoPlayer).not.toHaveBeenCalled();
});

test('falls back to the image if video playback fails', () => {
  jest.mocked(useEvent).mockReturnValue({ status: 'error' });
  render(<ExerciseMedia {...props} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Video unavailable.');
  expect(screen.getByLabelText('Bench press')).toBeTruthy();
  expect(screen.queryByLabelText('Video for Bench press')).toBeNull();
});

test('renders no media when neither video nor image exists', () => {
  const view = render(<ExerciseMedia {...props} videoUrl={null} imageUrl={null} />);
  expect(view.toJSON()).toBeNull();
});

test('styled controls pause, replay and unmute the player', () => {
  render(<ExerciseMedia {...props} />);
  const player = jest.mocked(useVideoPlayer).mock.results[0].value;
  fireEvent.press(screen.getByLabelText('Pause video'));
  expect(player.pause).toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Replay video'));
  expect(player.replay).toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Unmute video'));
  expect(player.muted).toBe(false);
  expect(screen.getByLabelText('Mute video')).toBeTruthy();
});

test('Spanish video controls expose translated sound and fullscreen actions', () => {
  render(
    <LanguageProvider language="es">
      <ExerciseMedia {...props} />
    </LanguageProvider>,
  );
  const player = jest.mocked(useVideoPlayer).mock.results[0].value;
  expect(screen.getByLabelText('Activar sonido')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Activar sonido'));
  expect(player.muted).toBe(false);
  expect(screen.getByLabelText('Silenciar vídeo')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Vídeo a pantalla completa'));
  expect(mockEnterFullscreen).toHaveBeenCalledTimes(1);
});

test('autoplay waits for readiness and does not restart after a later pause or buffer', () => {
  const player = {
    status: 'loading',
    playing: false,
    duration: 6,
    play: jest.fn(),
  } as unknown as ReturnType<typeof useVideoPlayer>;
  jest.mocked(useVideoPlayer).mockReturnValue(player);
  jest.mocked(useEvent).mockReturnValue({ status: 'loading', isPlaying: false, currentTime: 0 });
  const view = render(<ExerciseMedia {...props} />);
  expect(player.play).not.toHaveBeenCalled();
  jest
    .mocked(useEvent)
    .mockReturnValue({ status: 'readyToPlay', isPlaying: false, currentTime: 0 });
  view.rerender(<ExerciseMedia {...props} />);
  expect(player.play).toHaveBeenCalledTimes(1);
  jest.mocked(useEvent).mockReturnValue({ status: 'loading', isPlaying: false, currentTime: 2 });
  view.rerender(<ExerciseMedia {...props} />);
  jest
    .mocked(useEvent)
    .mockReturnValue({ status: 'readyToPlay', isPlaying: false, currentTime: 2 });
  view.rerender(<ExerciseMedia {...props} />);
  expect(player.play).toHaveBeenCalledTimes(1);
});
