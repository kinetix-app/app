/** Records the camera preview where the camera library cannot (the web). */
export type CameraRecorder = {
  start(): void;
  /** The recording as an address the app can read back, or null if nothing was captured. */
  stop(): Promise<string | null>;
};

/** Native platforms record with expo-camera itself. */
export function createCameraRecorder(_container: unknown): CameraRecorder | null {
  return null;
}
