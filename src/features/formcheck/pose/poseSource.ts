import { File } from 'expo-file-system';
import type { PoseSeries } from '../engine';
import { createWebViewPoseSource, webViewPose } from './webViewPose';

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
 * Android and iOS: the shared browser extractor in a hidden WebView (needs PoseWebViewHost
 * mounted, which FormCheckProvider does). A native MediaPipe module can replace it later without
 * touching anything else.
 */
export function createPoseSource(): PoseSource | null {
  return createWebViewPoseSource(webViewPose, (uri) => new File(uri).base64());
}
