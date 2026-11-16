import type { PoseSeries } from '../engine';

export type PoseProgress = (fraction: number) => void;

/** Turns a recorded set into MediaPipe landmarks, frame by frame, on the device. */
export interface PoseSource {
  extract(input: {
    uri: string;
    signal?: AbortSignal;
    onProgress?: PoseProgress;
  }): Promise<PoseSeries>;
}

/**
 * Native apps have no pose source yet: it needs a native MediaPipe module and a development build
 * (see docs/form-check.md). Until then the app keeps the demo analyzer on Android and iOS.
 */
export function createPoseSource(): PoseSource | null {
  return null;
}
