import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useCameraPermissions } from 'expo-camera';
import type { FormAnalyzer } from '../analyzer';
import { FormCheckFlow } from '../components/FormCheckFlow';
import { FormCheckProvider } from '../components/FormCheckProvider';
import { profileForExercise } from '../profiles';
import type { FormAnalysis } from '../schemas';
import { createFormCheckStorage, type RecordingFiles } from '../store';

jest.mock(
  '@react-native-async-storage/async-storage',
  () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }),
  { virtual: true },
);
jest.mock('../recordingFiles', () => ({ recordingFiles: { keep: jest.fn(), discard: jest.fn() } }));
jest.mock('expo-camera', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const CameraView = React.forwardRef(function CameraView(props: object, ref: React.Ref<unknown>) {
    React.useImperativeHandle(ref, () => ({
      recordAsync: () => new Promise((resolve) => (global.finishRecording = resolve)),
      stopRecording: () => global.finishRecording?.({ uri: 'file:///cache/video.mp4' }),
    }));
    return <View {...props} />;
  });
  return { CameraView, useCameraPermissions: jest.fn() };
});
jest.mock('expo-video', () => ({
  useVideoPlayer: () => ({ status: 'readyToPlay' }),
  VideoView: jest.requireActual('react-native').View,
}));
jest.mock('expo', () => ({ useEvent: () => ({ status: 'readyToPlay' }) }));
declare global {
  var finishRecording: ((value: { uri: string }) => void) | undefined;
}

const profile = profileForExercise('Back squat')!;
const base = { profileId: profile.id, analyzedAt: '2026-10-25T10:00:00.000Z', durationSeconds: 5 };
const withIssues: FormAnalysis = {
  ...base,
  status: 'assessed',
  reps: [
    { index: 1, issues: [] },
    { index: 2, issues: ['depth'] },
    { index: 3, issues: ['depth'] },
  ],
};
const cannot: FormAnalysis = { ...base, status: 'not_assessable', reasons: ['hips_not_visible'] };

function analyzerReturning(...results: (FormAnalysis | Error)[]): FormAnalyzer {
  let next = 0;
  return {
    isDemo: false,
    analyze: jest.fn(async () => {
      const result = results[Math.min(next++, results.length - 1)];
      if (result instanceof Error) throw result;
      return result;
    }),
  };
}
function granted(value: boolean, canAskAgain = true) {
  const request = jest.fn(async () => ({ granted: true }));
  jest
    .mocked(useCameraPermissions)
    .mockReturnValue([
      { granted: value, canAskAgain } as never,
      request as never,
      jest.fn() as never,
    ]);
  return request;
}
function setup(analyzer: FormAnalyzer, onClose = jest.fn()) {
  const files: RecordingFiles = {
    keep: jest.fn(async (uri: string) => `kept:${uri}`),
    discard: jest.fn(async () => undefined),
  };
  const storage = createFormCheckStorage({
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  });
  render(
    <FormCheckProvider
      accountId={1}
      liveSetIds={null}
      analyzer={analyzer}
      storage={storage}
      files={files}
    >
      <FormCheckFlow
        exerciseName="Back squat"
        profile={profile}
        setId="set-1"
        setNumber={3}
        onClose={onClose}
      />
    </FormCheckProvider>,
  );
  return { onClose, files };
}
const record = async () => {
  await waitFor(() => screen.getByText('Start recording'));
  fireEvent.press(screen.getByText('Start recording'));
  fireEvent.press(await screen.findByText('Stop and analyze'));
};

beforeEach(() => jest.clearAllMocks());

test('asks for the camera first and records once it is allowed', async () => {
  const request = granted(false);
  setup(analyzerReturning(withIssues));
  expect(screen.getByText('Check your form')).toBeTruthy();
  expect(screen.getByText(/Available for back squat, push-up/)).toBeTruthy();
  fireEvent.press(screen.getByText('Allow camera'));
  expect(request).toHaveBeenCalled();
});

test('sends the user to settings when the camera was refused for good', () => {
  granted(false, false);
  setup(analyzerReturning(withIssues));
  expect(screen.getByText('Open settings')).toBeTruthy();
  expect(screen.queryByText('Allow camera')).toBeNull();
  expect(screen.getByText(/Camera access is turned off/)).toBeTruthy();
});

test('records, analyzes and shows findings derived from the profile', async () => {
  granted(true);
  const { onClose, files } = setup(analyzerReturning(withIssues));
  await record();
  expect(await screen.findByText('Set analyzed')).toBeTruthy();
  expect(screen.getByText('Reps 2 and 3 stopped above parallel')).toBeTruthy();
  expect(screen.getByText(profile.checks[0].tip)).toBeTruthy();
  expect(files.keep).toHaveBeenCalledWith('file:///cache/video.mp4', expect.any(String));
  expect(screen.getByText('Watch recording')).toBeTruthy();
  fireEvent.press(screen.getByText('Watch recording'));
  expect(await screen.findByText('Your recording')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Back to analysis'));
  fireEvent.press(await screen.findByText('Done'));
  expect(onClose).toHaveBeenCalled();
});

test('explains why a recording cannot be assessed without grading the set', async () => {
  granted(true);
  setup(analyzerReturning(cannot));
  await record();
  expect(await screen.findByText("We couldn't check your form")).toBeTruthy();
  expect(screen.getByText("We can't see your hips")).toBeTruthy();
  expect(screen.getByText(/not marked as good or bad/)).toBeTruthy();
  expect(screen.queryByText('Set analyzed')).toBeNull();
});

test('offers a retry when the analysis itself fails', async () => {
  granted(true);
  const analyzer = analyzerReturning(new Error('boom'), withIssues);
  setup(analyzer);
  await record();
  expect(await screen.findByText('Something went wrong')).toBeTruthy();
  fireEvent.press(screen.getByText('Try again'));
  expect(await screen.findByText('Set analyzed')).toBeTruthy();
  expect(analyzer.analyze).toHaveBeenCalledTimes(2);
});

test('labels placeholder results as a demo', async () => {
  granted(true);
  setup({ ...analyzerReturning(withIssues), isDemo: true });
  await record();
  expect(await screen.findByText(/Demo analysis/)).toBeTruthy();
});

test('reopens a stored analysis without recording again', async () => {
  granted(true);
  const analyzer = analyzerReturning(withIssues);
  const { onClose } = setup(analyzer);
  await record();
  await screen.findByText('Set analyzed');
  await act(async () => {
    fireEvent.press(screen.getByText('Record again'));
  });
  expect(await screen.findByText('Start recording')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Cancel recording'));
  expect(await screen.findByText('Set analyzed')).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
});
