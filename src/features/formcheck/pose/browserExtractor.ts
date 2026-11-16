import type { PoseSeries } from '../engine';

/** What the extractor script installs on `window.kinetixPose`. */
export type BrowserPose = {
  extract(
    url: string,
    options?: { signal?: AbortSignal; onProgress?: (fraction: number) => void },
  ): Promise<PoseSeries>;
};

/**
 * Pose extraction that runs inside a browser engine: the web build evaluates it directly and the
 * Android and iOS apps run it in a hidden WebView (see PoseWebViewHost). One copy of the code, so
 * every platform produces the same landmarks.
 *
 * It is plain JavaScript text because the WebView receives it as-is. MediaPipe tasks-vision and the
 * pose model are downloaded from their CDNs on first use (same model as the Python reference); no
 * user data is sent. Each frame is sampled at 15 fps, enough for the engine (validated on the
 * Mendeley dataset).
 */
export const BROWSER_EXTRACTOR = String.raw`
(function () {
  if (window.kinetixPose) return;
  var CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0';
  var MODEL_URL =
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';
  var SAMPLE_FPS = 15;
  var landmarker = null;
  // In video mode the landmarker needs timestamps that keep increasing for its whole life: each
  // recording continues from where the previous one ended.
  var clockMs = 0;

  function loadLandmarker() {
    if (!landmarker) {
      landmarker = (async function () {
        var vision = await import(CDN + '/vision_bundle.mjs');
        var fileset = await vision.FilesetResolver.forVisionTasks(CDN + '/wasm');
        var options = function (delegate) {
          return {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: delegate },
            runningMode: 'VIDEO',
            numPoses: 1,
          };
        };
        try {
          return await vision.PoseLandmarker.createFromOptions(fileset, options('GPU'));
        } catch (e) {
          return vision.PoseLandmarker.createFromOptions(fileset, options('CPU'));
        }
      })();
      // Let a later attempt retry, e.g. after the network comes back.
      landmarker.catch(function () { landmarker = null; });
    }
    return landmarker;
  }

  function aborted() {
    return new DOMException('Aborted', 'AbortError');
  }

  function once(target, event, signal) {
    return new Promise(function (resolve, reject) {
      var done = function () {
        target.removeEventListener(event, done);
        target.removeEventListener('error', failed);
        resolve();
      };
      var failed = function () {
        target.removeEventListener(event, done);
        reject(new Error('The recording could not be read'));
      };
      target.addEventListener(event, done);
      target.addEventListener('error', failed);
      if (signal) signal.addEventListener('abort', function () { reject(aborted()); }, { once: true });
    });
  }

  async function seek(video, time, signal) {
    var seeked = once(video, 'seeked', signal);
    video.currentTime = time;
    await seeked;
  }

  async function openVideo(url, signal) {
    var video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    var loaded = once(video, 'loadeddata', signal);
    video.src = url;
    await loaded;
    // MediaRecorder files often report an infinite duration until the end has been reached once.
    if (!isFinite(video.duration)) {
      await seek(video, 1e7, signal);
      await seek(video, 0, signal);
    }
    return video;
  }

  function nanRow(width) {
    var row = [];
    for (var i = 0; i < 33; i++) row.push(width === 2 ? [NaN, NaN] : [NaN, NaN, NaN]);
    return row;
  }

  async function extract(url, opts) {
    var signal = opts && opts.signal;
    var onProgress = opts && opts.onProgress;
    var both = await Promise.all([loadLandmarker(), openVideo(url, signal)]);
    var model = both[0];
    var video = both[1];
    var series = { t: [], xy: [], visibility: [], world: [], width: video.videoWidth, height: video.videoHeight };
    var frames = Math.floor(video.duration * SAMPLE_FPS);
    var startMs = clockMs;
    var lastMs = clockMs - 1;
    try {
      for (var i = 0; i <= frames; i++) {
        if (signal && signal.aborted) throw aborted();
        var time = i / SAMPLE_FPS;
        await seek(video, Math.min(time, video.duration), signal);
        var ms = Math.max(startMs + Math.round(time * 1000), lastMs + 1); // must strictly increase
        lastMs = ms;
        clockMs = ms + 1;
        var result = model.detectForVideo(video, ms);
        var pose = result.landmarks[0];
        var world = result.worldLandmarks[0];
        series.t.push(time);
        series.xy.push(pose ? pose.map(function (p) { return [p.x, p.y]; }) : nanRow(2));
        series.visibility.push(
          pose ? pose.map(function (p) { return p.visibility == null ? 0 : p.visibility; }) : new Array(33).fill(0),
        );
        series.world.push(world ? world.map(function (p) { return [p.x, p.y, p.z]; }) : nanRow(3));
        if (onProgress) onProgress(frames ? i / frames : 1);
      }
    } finally {
      video.removeAttribute('src');
      video.load();
    }
    return series;
  }

  window.kinetixPose = { extract: extract };
})();
`;
