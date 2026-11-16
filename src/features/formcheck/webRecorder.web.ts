import type { CameraRecorder } from './webRecorder';

const TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];

/**
 * expo-camera shows the webcam in a <video> element on the web but cannot record it. This records
 * that element's stream with the browser's MediaRecorder, keeping the video on the device.
 */
export function createCameraRecorder(container: unknown): CameraRecorder | null {
  if (typeof MediaRecorder === 'undefined' || !(container instanceof HTMLElement)) return null;
  const mimeType = TYPES.find((type) => MediaRecorder.isTypeSupported(type));
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  return {
    start() {
      const stream = container.querySelector('video')?.srcObject;
      if (!(stream instanceof MediaStream)) return;
      chunks = [];
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.start(1000);
    },
    stop() {
      const active = recorder;
      recorder = null;
      if (!active || active.state === 'inactive') return Promise.resolve(null);
      return new Promise((resolve) => {
        active.onstop = () => {
          const blob = new Blob(chunks, { type: active.mimeType || 'video/webm' });
          chunks = [];
          resolve(blob.size ? URL.createObjectURL(blob) : null);
        };
        active.stop();
      });
    },
  };
}
