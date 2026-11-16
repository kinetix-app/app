// Types only: the library itself is loaded at runtime (see loadVision).
import type * as Vision from '@mediapipe/tasks-vision';

import type { PoseSeries } from '../engine';
import type { PoseSource } from './poseSource';

/** Same model as the Python reference; downloaded once by the browser, no user data is sent. */
const TASKS_VERSION = '1.2.0';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}`;
const WASM_URL = `${CDN}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';
/** 15 fps is enough for the engine (validated on the Mendeley dataset) and halves the work. */
const SAMPLE_FPS = 15;

let landmarker: Promise<Vision.PoseLandmarker> | null = null;

/**
 * Metro cannot bundle tasks-vision (it contains `import(url)`), so the pinned version is loaded as
 * an ES module from the same CDN as its WebAssembly. `new Function` keeps Metro from rewriting it.
 */
const importModule = new Function('url', 'return import(url)') as (url: string) => Promise<unknown>;
function loadVision(): Promise<typeof Vision> {
  return importModule(`${CDN}/vision_bundle.mjs`) as Promise<typeof Vision>;
}

function loadLandmarker(): Promise<Vision.PoseLandmarker> {
  landmarker ??= (async () => {
    const { FilesetResolver, PoseLandmarker } = await loadVision();
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    const options = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO' as const,
      numPoses: 1,
    });
    try {
      return await PoseLandmarker.createFromOptions(fileset, options('GPU'));
    } catch {
      return PoseLandmarker.createFromOptions(fileset, options('CPU'));
    }
  })().catch((error: unknown) => {
    landmarker = null; // let a later attempt retry, e.g. after the network comes back
    throw error;
  });
  return landmarker;
}

function once(target: HTMLVideoElement, event: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      target.removeEventListener(event, done);
      target.removeEventListener('error', failed);
      resolve();
    };
    const failed = () => {
      target.removeEventListener(event, done);
      reject(new Error('The recording could not be read'));
    };
    target.addEventListener(event, done);
    target.addEventListener('error', failed);
    signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
      once: true,
    });
  });
}

async function seek(video: HTMLVideoElement, time: number, signal?: AbortSignal) {
  const seeked = once(video, 'seeked', signal);
  video.currentTime = time;
  await seeked;
}

async function openVideo(uri: string, signal?: AbortSignal): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const loaded = once(video, 'loadeddata', signal);
  video.src = uri;
  await loaded;
  // MediaRecorder files often report an infinite duration until the end has been reached once.
  if (!Number.isFinite(video.duration)) {
    await seek(video, 1e7, signal);
    await seek(video, 0, signal);
  }
  return video;
}

const nan2 = () => [NaN, NaN];
const nan3 = () => [NaN, NaN, NaN];

/** Reads the recording at SAMPLE_FPS and runs the MediaPipe pose landmarker on each frame. */
export function createPoseSource(): PoseSource {
  return {
    async extract({ uri, signal, onProgress }): Promise<PoseSeries> {
      const [model, video] = await Promise.all([loadLandmarker(), openVideo(uri, signal)]);
      const series: PoseSeries = {
        t: [],
        xy: [],
        visibility: [],
        world: [],
        width: video.videoWidth,
        height: video.videoHeight,
      };
      const frames = Math.floor(video.duration * SAMPLE_FPS);
      let lastMs = -1;
      for (let i = 0; i <= frames; i++) {
        signal?.throwIfAborted();
        const time = i / SAMPLE_FPS;
        await seek(video, Math.min(time, video.duration), signal);
        const ms = Math.max(Math.round(time * 1000), lastMs + 1); // must strictly increase
        lastMs = ms;
        const result = model.detectForVideo(video, ms);
        const pose = result.landmarks[0];
        const world = result.worldLandmarks[0];
        series.t.push(time);
        series.xy.push(pose ? pose.map((p) => [p.x, p.y]) : Array.from({ length: 33 }, nan2));
        series.visibility.push(pose ? pose.map((p) => p.visibility ?? 0) : new Array(33).fill(0));
        series.world?.push(
          world ? world.map((p) => [p.x, p.y, p.z]) : Array.from({ length: 33 }, nan3),
        );
        onProgress?.(frames ? i / frames : 1);
      }
      video.removeAttribute('src');
      video.load();
      return series;
    },
  };
}
