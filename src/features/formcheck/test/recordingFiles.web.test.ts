import { recordingFiles as browserFiles } from '../recordingFiles.web';

test('browser recordings retain their blob URL until discard and ignore non-blob URLs', async () => {
  const revoke = jest.fn();
  const original = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
  try {
    await expect(browserFiles.keep('blob:recording', 'set')).resolves.toBe('blob:recording');
    expect(revoke).not.toHaveBeenCalled();
    await browserFiles.discard('blob:recording');
    await browserFiles.discard('https://example.test/video.mp4');
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:recording');
  } finally {
    if (original) Object.defineProperty(URL, 'revokeObjectURL', original);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  }
});
