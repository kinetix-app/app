import AsyncStorage from '@react-native-async-storage/async-storage';
import { formCheckEntriesSchema, type FormCheckEntry } from './schemas';

export interface EntryStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
export const formCheckStorageKey = (accountId: number) =>
  `kinetix.formcheck.v1.account.${accountId}`;

/** Keeps the recorded sets of one account on this device. */
export function createFormCheckStorage(adapter: EntryStorageAdapter = AsyncStorage) {
  const queues = new Map<string, Promise<unknown>>();
  function enqueue<T>(accountId: number, action: () => Promise<T>): Promise<T> {
    const key = formCheckStorageKey(accountId);
    const result = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(action);
    queues.set(key, result);
    return result;
  }
  return {
    load: (accountId: number) =>
      enqueue(accountId, async (): Promise<FormCheckEntry[]> => {
        const text = await adapter.getItem(formCheckStorageKey(accountId));
        if (text === null) return [];
        return formCheckEntriesSchema.parse(JSON.parse(text)).entries;
      }),
    save: (accountId: number, entries: FormCheckEntry[]) =>
      enqueue(accountId, () =>
        entries.length
          ? adapter.setItem(
              formCheckStorageKey(accountId),
              JSON.stringify(formCheckEntriesSchema.parse({ version: 1, entries })),
            )
          : adapter.removeItem(formCheckStorageKey(accountId)),
      ),
  };
}
export const formCheckStorage = createFormCheckStorage();

/** Where recorded videos live. The native version moves them out of the cache. */
export interface RecordingFiles {
  /** Keeps a freshly recorded video and returns the address to play it from. */
  keep(uri: string, name: string): Promise<string>;
  /** Deletes a kept video. Never throws: a missing file is already gone. */
  discard(uri: string): Promise<void>;
}
