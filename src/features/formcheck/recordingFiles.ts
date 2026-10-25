import { Directory, File, Paths } from 'expo-file-system';
import type { RecordingFiles } from './store';

export const recordingFiles: RecordingFiles = {
  async keep(uri, name) {
    const directory = new Directory(Paths.document, 'form-check');
    directory.create({ idempotent: true, intermediates: true });
    const target = new File(directory, `${name}.mp4`);
    if (target.exists) target.delete();
    new File(uri).move(target);
    return target.uri;
  },
  async discard(uri) {
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      // Nothing left to clean up.
    }
  },
};
