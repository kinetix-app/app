import type { RecordingFiles } from './store';

/** Browsers keep the recording as a blob address that lives as long as the page. */
export const recordingFiles: RecordingFiles = {
  async keep(uri) {
    return uri;
  },
  async discard(uri) {
    if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
  },
};
