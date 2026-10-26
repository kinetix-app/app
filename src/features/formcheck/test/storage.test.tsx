import React from 'react';
import { Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { FormCheckProvider, useFormCheck } from '../components/FormCheckProvider';
import type { FormAnalysis, FormCheckEntry } from '../schemas';
import { createFormCheckStorage, formCheckStorageKey, type RecordingFiles } from '../store';

jest.mock(
  '@react-native-async-storage/async-storage',
  () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }),
  { virtual: true },
);
jest.mock('../recordingFiles', () => ({ recordingFiles: { keep: jest.fn(), discard: jest.fn() } }));

const analysis: FormAnalysis = {
  status: 'assessed',
  profileId: 'back-squat',
  analyzedAt: '2026-10-25T10:00:00.000Z',
  durationSeconds: 20,
  reps: [{ index: 1, issues: [] }],
};
const entry = (setId: string, uri: string | null = `file:///${setId}.mp4`): FormCheckEntry => ({
  setId,
  recordedAt: '2026-10-25T10:00:00.000Z',
  recording: { uri, durationSeconds: 20 },
  analysis,
});

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    adapter: {
      getItem: async (key: string) => data.get(key) ?? null,
      setItem: async (key: string, value: string) => void data.set(key, value),
      removeItem: async (key: string) => void data.delete(key),
    },
  };
}

test('round-trips entries per account and clears the key when empty', async () => {
  const { adapter, data } = memory();
  const storage = createFormCheckStorage(adapter);
  expect(await storage.load(1)).toEqual([]);
  await storage.save(1, [entry('a')]);
  expect(await storage.load(1)).toEqual([entry('a')]);
  expect(await storage.load(2)).toEqual([]);
  await storage.save(1, []);
  expect(data.has(formCheckStorageKey(1))).toBe(false);
});

test('rejects stored data that does not match the schema', async () => {
  const { adapter, data } = memory();
  data.set(formCheckStorageKey(1), JSON.stringify({ version: 1, entries: [{ setId: 1 }] }));
  await expect(createFormCheckStorage(adapter).load(1)).rejects.toThrow();
});

function Probe({ onReady }: { onReady: (api: ReturnType<typeof useFormCheck>) => void }) {
  const api = useFormCheck();
  onReady(api);
  return <Text>{api.loaded ? `loaded:${api.entryFor('a') ? 'a' : '-'}` : 'loading'}</Text>;
}

test('keeps a new recording, replaces the old file and drops recordings of removed sets', async () => {
  const { adapter } = memory();
  const storage = createFormCheckStorage(adapter);
  await storage.save(1, [entry('a', 'file:///old.mp4'), entry('b')]);
  const files: RecordingFiles = {
    keep: jest.fn(async (uri: string) => `kept:${uri}`),
    discard: jest.fn(async () => undefined),
  };
  let api!: ReturnType<typeof useFormCheck>;
  const tree = (live: Set<string> | null) => (
    <FormCheckProvider accountId={1} liveSetIds={live} storage={storage} files={files}>
      <Probe onReady={(value) => (api = value)} />
    </FormCheckProvider>
  );
  const view = render(tree(null));
  await waitFor(() => expect(screen.getByText('loaded:a')).toBeTruthy());
  // Nothing is deleted while the live sets are still unknown.
  expect(files.discard).not.toHaveBeenCalled();

  await act(async () => {
    await api.save('a', { uri: 'file:///new.mp4', durationSeconds: 8 }, analysis);
  });
  expect(files.keep).toHaveBeenCalledWith('file:///new.mp4', expect.stringContaining('a-'));
  expect(files.discard).toHaveBeenCalledWith('file:///old.mp4');
  expect(api.entryFor('a')?.recording.uri).toBe('kept:file:///new.mp4');

  view.rerender(tree(new Set(['a'])));
  await waitFor(() => expect(files.discard).toHaveBeenCalledWith('file:///b.mp4'));
  expect((await storage.load(1)).map((e) => e.setId)).toEqual(['a']);
});
