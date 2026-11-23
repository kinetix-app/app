import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { RecordingPlayer } from '../components/RecordingPlayer';
import type { PoseTrack } from '../schemas';

jest.mock('expo-video', () => ({
  useVideoPlayer: () => ({ status: 'readyToPlay' }),
  VideoView: jest.requireActual('react-native').View,
}));
jest.mock('expo', () => ({
  useEvent: (_player: unknown, _event: string, initial: object) => ({
    ...initial,
    status: 'readyToPlay',
  }),
}));

const pose: PoseTrack = {
  width: 640,
  height: 480,
  joints: ['left_shoulder', 'left_hip'],
  t: [0, 0.1],
  frames: [
    [0.5, 0.3, 0.5, 0.6],
    [0.5, 0.3, null, null],
  ],
  reps: [{ start: 0, end: 0.1, faultJoints: ['left_hip'] }],
};

describe('RecordingPlayer', () => {
  it('offers to hide and show the joints when the analysis kept them', () => {
    render(
      <RecordingPlayer
        uri="file:///set.mp4"
        title="Push-up · set 1"
        pose={pose}
        onBack={jest.fn()}
      />,
    );
    expect(screen.getByText('Joints turn red during a rep with a fault there.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Hide joints' }));
    expect(screen.getByRole('button', { name: 'Show joints' })).toBeTruthy();
    expect(screen.queryByText('Joints turn red during a rep with a fault there.')).toBeNull();
  });

  it('has no joint controls for results without poses', () => {
    render(<RecordingPlayer uri="file:///set.mp4" title="Push-up · set 1" onBack={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Hide joints' })).toBeNull();
  });
});
