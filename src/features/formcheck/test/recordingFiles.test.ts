import { Directory, File, Paths } from 'expo-file-system';
import { recordingFiles } from '../recordingFiles';

jest.mock('expo-file-system', () => ({
  Directory: jest.fn(),
  File: jest.fn(),
  Paths: { document: 'file:///documents' },
}));
beforeEach(() => {
  jest.resetAllMocks();
});
test.each([true, false])(
  'moves a recording to durable storage, replacing the target only if present (%s)',
  async (exists) => {
    const directory = { create: jest.fn() };
    const target = { exists, delete: jest.fn(), uri: 'file:///documents/form-check/set-1.mp4' };
    const source = { move: jest.fn() };
    jest.mocked(Directory).mockReturnValue(directory as unknown as Directory);
    jest
      .mocked(File)
      .mockReturnValueOnce(target as unknown as File)
      .mockReturnValueOnce(source as unknown as File);
    await expect(recordingFiles.keep('file:///temporary.mp4', 'set-1')).resolves.toBe(target.uri);
    expect(Directory).toHaveBeenCalledWith(Paths.document, 'form-check');
    expect(directory.create).toHaveBeenCalledWith({ idempotent: true, intermediates: true });
    expect(File).toHaveBeenNthCalledWith(1, directory, 'set-1.mp4');
    expect(File).toHaveBeenNthCalledWith(2, 'file:///temporary.mp4');
    expect(target.delete).toHaveBeenCalledTimes(exists ? 1 : 0);
    expect(source.move).toHaveBeenCalledWith(target);
  },
);
test.each([true, false])('discards only recordings that still exist (%s)', async (exists) => {
  const file = { exists, delete: jest.fn() };
  jest.mocked(File).mockReturnValue(file as unknown as File);
  await recordingFiles.discard('file:///old.mp4');
  expect(file.delete).toHaveBeenCalledTimes(exists ? 1 : 0);
});
test('tolerates already inaccessible recordings but propagates a failed move', async () => {
  jest.mocked(File).mockImplementation(() => {
    throw new Error('inaccessible');
  });
  await expect(recordingFiles.discard('file:///gone.mp4')).resolves.toBeUndefined();
  jest.mocked(Directory).mockReturnValue({ create: jest.fn() } as unknown as Directory);
  await expect(recordingFiles.keep('file:///gone.mp4', 'set')).rejects.toThrow('inaccessible');
});
