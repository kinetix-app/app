import AsyncStorage from '@react-native-async-storage/async-storage';
import { sessionDraftSchema, type SessionDraft } from './sessionDraft';

export interface DraftStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
const queues = new Map<string, Promise<unknown>>();
export const sessionStorageKey = (accountId: number) => `kinetix.workout.v1.account.${accountId}`;
/** Serializes reads and writes, including sign-out clearing and subsequent reauthentication. */
export function createSessionStorage(adapter: DraftStorage = AsyncStorage) {
  function enqueue<T>(accountId: number, action: () => Promise<T>): Promise<T> {
    const key = sessionStorageKey(accountId);
    const result = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(action);
    queues.set(key, result);
    void result
      .finally(() => {
        if (queues.get(key) === result) queues.delete(key);
      })
      .catch(() => undefined);
    return result;
  }
  return {
    load: (accountId: number) =>
      enqueue(accountId, async () => {
        const text = await adapter.getItem(sessionStorageKey(accountId));
        if (text === null) return null;
        const draft = sessionDraftSchema.parse(JSON.parse(text));
        if (draft.accountId !== accountId) throw new Error('Draft account does not match.');
        return draft;
      }),
    save: (draft: SessionDraft) =>
      enqueue(draft.accountId, () =>
        adapter.setItem(
          sessionStorageKey(draft.accountId),
          JSON.stringify(sessionDraftSchema.parse(draft)),
        ),
      ),
    clear: (accountId: number) =>
      enqueue(accountId, () => adapter.removeItem(sessionStorageKey(accountId))),
  };
}
export const sessionStorage = createSessionStorage();
