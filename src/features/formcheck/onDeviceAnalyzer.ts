import { getFormCheckAnalyzer, type FormCheckAnalyzerMode } from '@/config/environment';
import type { FormAnalyzer } from './analyzer';
import { createDemoAnalyzer } from './demoAnalyzer';
import { analyze, bundledSpecs } from './engine';
import { toFormAnalysis } from './engineAnalysis';
import { createPoseSource, type PoseSource } from './pose/poseSource';

/**
 * Real form analysis on the device: MediaPipe landmarks from the recording, then the technique
 * engine. Nothing leaves the device.
 */
export function createOnDeviceAnalyzer({
  poseSource,
  specs = bundledSpecs,
}: {
  poseSource: PoseSource;
  specs?: typeof bundledSpecs;
}): FormAnalyzer {
  return {
    isDemo: false,
    async analyze({ profile, recording, signal }) {
      if (!recording.uri) {
        return {
          profileId: profile.id,
          analyzedAt: new Date().toISOString(),
          durationSeconds: recording.durationSeconds,
          status: 'not_assessable',
          reasons: ['no_recording'],
        };
      }
      const series = await poseSource.extract({ uri: recording.uri, signal });
      signal?.throwIfAborted();
      // The app's copy is English; the engine's own texts are not shown.
      return toFormAnalysis(analyze(series, specs[profile.specId], 'en'), profile, recording);
    },
  };
}

/** The engine where this platform can extract poses, otherwise (or when configured) the demo. */
export function createDefaultAnalyzer(
  mode: FormCheckAnalyzerMode = getFormCheckAnalyzer(),
  poseSource: PoseSource | null = createPoseSource(),
): FormAnalyzer {
  return mode === 'engine' && poseSource
    ? createOnDeviceAnalyzer({ poseSource })
    : createDemoAnalyzer();
}
