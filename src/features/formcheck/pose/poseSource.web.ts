import { BROWSER_EXTRACTOR, type BrowserPose } from './browserExtractor';
import type { PoseSource } from './poseSource';

const SCRIPT_ID = 'kinetix-pose-extractor';

/**
 * Installs the shared browser extractor in the page as a script element, exactly as the native
 * apps do in their WebView. It is not bundled: Metro cannot bundle tasks-vision (it contains
 * `import(url)`), so the extractor loads the library from its CDN at runtime.
 */
function browserPose(): BrowserPose {
  const scope = window as unknown as { kinetixPose?: BrowserPose };
  if (!scope.kinetixPose && !document.getElementById(SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.textContent = BROWSER_EXTRACTOR;
    document.head.appendChild(script); // inline scripts run synchronously on insertion
  }
  if (!scope.kinetixPose) throw new Error('The pose extractor could not start');
  return scope.kinetixPose;
}

export function createPoseSource(): PoseSource {
  return {
    extract: async ({ uri, signal, onProgress }) =>
      browserPose().extract(uri, { signal, onProgress }),
  };
}
