import { BROWSER_EXTRACTOR, type BrowserPose } from './browserExtractor';
import type { PoseSource } from './poseSource';

/**
 * Runs the shared browser extractor in the page itself. It is evaluated with `new Function` rather
 * than bundled: Metro cannot bundle tasks-vision (it contains `import(url)`), and the native apps
 * run the exact same text in a WebView.
 */
function browserPose(): BrowserPose {
  const scope = window as unknown as { kinetixPose?: BrowserPose };
  if (!scope.kinetixPose) new Function(BROWSER_EXTRACTOR)();
  return scope.kinetixPose!;
}

export function createPoseSource(): PoseSource {
  return {
    extract: ({ uri, signal, onProgress }) => browserPose().extract(uri, { signal, onProgress }),
  };
}
