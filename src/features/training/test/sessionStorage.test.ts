import { createSessionStorage, sessionStorageKey, type DraftStorage } from '../sessionStorage';
import { createSessionDraft } from '../sessionDraft';
jest.mock(
  '@react-native-async-storage/async-storage',
  () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }),
  { virtual: true },
);
jest.mock('expo-crypto', () => ({
  randomUUID: () => '3e17c183-38a9-4b5c-b953-7ae49433af17',
}));
function memory(): DraftStorage {
  const items = new Map<string, string>();
  return {
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => {
      items.set(key, value);
    },
    removeItem: async (key) => {
      items.delete(key);
    },
  };
}
test('account keys isolate durable drafts and authenticated relaunch restores original data', async () => {
  const adapter = memory();
  const store = createSessionStorage(adapter);
  const a = createSessionDraft(1),
    b = createSessionDraft(2);
  await Promise.all([store.save(a), store.save(b)]);
  expect(await createSessionStorage(adapter).load(1)).toEqual(a);
  expect(await store.load(2)).toEqual(b);
  await store.clear(1);
  expect(await store.load(1)).toBeNull();
  expect(await store.load(2)).toEqual(b);
});
test('writes serialize through logout so late writes cannot resurrect a cleared draft', async () => {
  const adapter = memory();
  const events: string[] = [];
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const store = createSessionStorage({
    ...adapter,
    setItem: async (key, value) => {
      await pending;
      events.push('save');
      await adapter.setItem(key, value);
    },
    removeItem: async (key) => {
      events.push('clear');
      await adapter.removeItem(key);
    },
  });
  const save = store.save(createSessionDraft(3));
  const clear = store.clear(3);
  release();
  await Promise.all([save, clear]);
  expect(events).toEqual(['save', 'clear']);
  expect(await store.load(3)).toBeNull();
});
test('corrupt, unsupported and mismatched account records fail visibly instead of replacing data', async () => {
  const adapter = memory();
  const store = createSessionStorage(adapter);
  await adapter.setItem(sessionStorageKey(4), JSON.stringify(createSessionDraft(5)));
  await expect(store.load(4)).rejects.toThrow('Draft account');
  await adapter.setItem(sessionStorageKey(4), 'not-json');
  await expect(store.load(4)).rejects.toThrow();
});
test('a storage failure propagates and later retry can restore persistence', async () => {
  const adapter = memory();
  const fail = jest
    .fn()
    .mockRejectedValueOnce(new Error('disk full'))
    .mockImplementation(adapter.setItem);
  const store = createSessionStorage({ ...adapter, setItem: fail });
  const draft = createSessionDraft(6);
  await expect(store.save(draft)).rejects.toThrow('disk full');
  await store.save(draft);
  expect(await store.load(6)).toEqual(draft);
});
