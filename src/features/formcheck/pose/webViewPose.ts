import type { PoseSeries } from '../engine';
import { BROWSER_EXTRACTOR } from './browserExtractor';
import type { PoseSource } from './poseSource';

/**
 * Android and iOS have no MediaPipe for React Native, so poses are extracted by the same browser
 * code as the web build, inside a hidden WebView (PoseWebViewHost). This file is the app side of
 * that bridge: it sends the recording in base64 chunks and receives the landmarks back.
 */

/** Base64 characters per injected chunk (a multiple of 4, so each chunk decodes on its own). */
export const CHUNK_CHARS = 1 << 20;
/** How long the page may take to start before extraction is given up. */
const READY_TIMEOUT_MS = 20_000;

/** The page loaded in the WebView: the extractor plus the message protocol. */
export const POSE_PAGE_HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width"></head><body><script>
${BROWSER_EXTRACTOR}
(function () {
  var post = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var parts = {};
  var jobs = {};
  window.kinetixReceive = function (id, b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    (parts[id] = parts[id] || []).push(bytes);
  };
  window.kinetixRun = function (id, mime) {
    var url = URL.createObjectURL(new Blob(parts[id] || [], { type: mime }));
    delete parts[id];
    var controller = new AbortController();
    jobs[id] = controller;
    var last = -1;
    window.kinetixPose
      .extract(url, {
        signal: controller.signal,
        onProgress: function (f) {
          var pct = Math.floor(f * 100);
          if (pct !== last) { last = pct; post({ id: id, type: 'progress', value: f }); }
        },
      })
      .then(
        function (series) { post({ id: id, type: 'done', series: series }); },
        function (e) { post({ id: id, type: 'error', name: e && e.name, message: String((e && e.message) || e) }); },
      )
      .then(function () { URL.revokeObjectURL(url); delete jobs[id]; });
  };
  window.kinetixCancel = function (id) {
    delete parts[id];
    if (jobs[id]) jobs[id].abort();
  };
  post({ type: 'ready' });
})();
</script></body></html>`;

type Message =
  | { type: 'ready' }
  | { id: number; type: 'progress'; value: number }
  | { id: number; type: 'done'; series: PoseSeries }
  | { id: number; type: 'error'; name?: string; message: string };

type Job = {
  resolve: (series: PoseSeries) => void;
  reject: (error: unknown) => void;
  onProgress?: (fraction: number) => void;
};

/** JSON turns NaN (frames or joints without a pose) into null; the engine expects NaN back. */
function revive(series: PoseSeries): PoseSeries {
  const nan = (v: number | null) => v ?? Number.NaN;
  return {
    ...series,
    xy: series.xy.map((frame) => frame.map((p) => p.map(nan))),
    visibility: series.visibility.map((frame) => frame.map((v) => v ?? 0)),
    world: series.world?.map((frame) => frame.map((p) => p.map(nan))),
  };
}

function abortError() {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

export function mimeFor(uri: string): string {
  if (/\.mov$/i.test(uri)) return 'video/quicktime';
  if (/\.webm$/i.test(uri)) return 'video/webm';
  return 'video/mp4';
}

export class WebViewPoseBridge {
  private inject: ((js: string) => void) | null = null;
  private ready = false;
  private wanted = false;
  private waiting: { resolve: () => void; reject: (e: unknown) => void }[] = [];
  private readonly jobs = new Map<number, Job>();
  private nextId = 1;
  private readonly listeners = new Set<() => void>();

  /** The host mounts the WebView only once a recording needs it, then keeps it for later sets. */
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  isWanted = () => this.wanted;

  attach(inject: (js: string) => void) {
    this.inject = inject;
  }

  /** The WebView went away (unmounted or its process died): fail what was running. */
  detach() {
    this.inject = null;
    this.ready = false;
    const error = new Error('The pose analysis stopped unexpectedly');
    for (const job of this.jobs.values()) job.reject(error);
    this.jobs.clear();
  }

  handleMessage(raw: string) {
    let message: Message;
    try {
      message = JSON.parse(raw) as Message;
    } catch {
      return;
    }
    if (message.type === 'ready') {
      this.ready = true;
      for (const w of this.waiting.splice(0)) w.resolve();
      return;
    }
    const job = this.jobs.get(message.id);
    if (!job) return;
    if (message.type === 'progress') {
      job.onProgress?.(message.value);
      return;
    }
    this.jobs.delete(message.id);
    if (message.type === 'done') job.resolve(revive(message.series));
    else {
      const error = new Error(message.message);
      if (message.name) error.name = message.name;
      job.reject(error);
    }
  }

  private whenReady(): Promise<void> {
    if (this.ready && this.inject) return Promise.resolve();
    if (!this.wanted) {
      this.wanted = true;
      for (const listener of this.listeners) listener();
    }
    return new Promise((resolve, reject) => {
      const entry = {
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject,
      };
      const timer = setTimeout(() => {
        this.waiting = this.waiting.filter((w) => w !== entry);
        reject(new Error('The pose analysis could not start'));
      }, READY_TIMEOUT_MS);
      this.waiting.push(entry);
    });
  }

  async extract(input: {
    base64: string;
    mime: string;
    signal?: AbortSignal;
    onProgress?: (fraction: number) => void;
  }): Promise<PoseSeries> {
    await this.whenReady();
    if (input.signal?.aborted) throw abortError();
    const inject = this.inject!;
    const id = this.nextId++;
    const result = new Promise<PoseSeries>((resolve, reject) => {
      this.jobs.set(id, { resolve, reject, onProgress: input.onProgress });
      input.signal?.addEventListener(
        'abort',
        () => {
          if (!this.jobs.delete(id)) return;
          this.inject?.(`window.kinetixCancel(${id});true;`);
          reject(abortError());
        },
        { once: true },
      );
    });
    for (let at = 0; at < input.base64.length; at += CHUNK_CHARS) {
      inject(`window.kinetixReceive(${id},"${input.base64.slice(at, at + CHUNK_CHARS)}");true;`);
    }
    inject(`window.kinetixRun(${id},${JSON.stringify(input.mime)});true;`);
    return result;
  }
}

/** One WebView serves the whole app. */
export const webViewPose = new WebViewPoseBridge();

export function createWebViewPoseSource(
  bridge: WebViewPoseBridge,
  readBase64: (uri: string) => Promise<string>,
): PoseSource {
  return {
    async extract({ uri, signal, onProgress }) {
      const base64 = await readBase64(uri);
      signal?.throwIfAborted();
      return bridge.extract({ base64, mime: mimeFor(uri), signal, onProgress });
    },
  };
}
