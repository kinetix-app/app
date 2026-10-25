import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { FormAnalyzer } from '../analyzer';
import { createDemoAnalyzer } from '../demoAnalyzer';
import { recordingFiles } from '../recordingFiles';
import type { FormAnalysis, FormCheckEntry, Recording } from '../schemas';
import { formCheckStorage, type RecordingFiles } from '../store';

type Controller = {
  analyzer: FormAnalyzer;
  loaded: boolean;
  entryFor: (setId: string) => FormCheckEntry | undefined;
  /** Stores a recorded set, replacing and deleting any earlier recording of it. */
  save: (setId: string, recording: Recording, analysis: FormAnalysis) => Promise<void>;
  remove: (setId: string) => Promise<void>;
};
const FormCheckContext = createContext<Controller | null>(null);
export function useFormCheck() {
  const value = useContext(FormCheckContext);
  if (!value) throw new Error('Form check provider missing.');
  return value;
}

export function FormCheckProvider({
  accountId,
  liveSetIds,
  analyzer,
  storage = formCheckStorage,
  files = recordingFiles,
  children,
}: React.PropsWithChildren<{
  accountId: number;
  /** Ids of the sets that still exist. Recordings of any other set are deleted. null: not known yet. */
  liveSetIds: ReadonlySet<string> | null;
  analyzer?: FormAnalyzer;
  storage?: Pick<typeof formCheckStorage, 'load' | 'save'>;
  files?: RecordingFiles;
}>) {
  const [entries, setEntries] = useState<FormCheckEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const current = useRef<FormCheckEntry[]>([]);
  const [fallback] = useState(() => createDemoAnalyzer());
  const install = (next: FormCheckEntry[]) => {
    current.current = next;
    setEntries(next);
  };
  useEffect(() => {
    let alive = true;
    void storage
      .load(accountId)
      .then((stored) => {
        if (!alive) return;
        install(stored);
        setLoaded(true);
      })
      .catch(() => {
        // Unreadable storage must not block training; recordings simply start empty.
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
    // Mount once per account (the home screen remounts on account change); adapters are fixed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  async function commit(next: FormCheckEntry[]) {
    install(next);
    try {
      await storage.save(accountId, next);
    } catch {
      // The in-memory result still serves this session.
    }
  }
  // Remove recordings whose set was removed, finished or discarded.
  useEffect(() => {
    if (!loaded || !liveSetIds) return;
    const stale = current.current.filter((entry) => !liveSetIds.has(entry.setId));
    if (!stale.length) return;
    void Promise.all(
      stale.flatMap((e) => (e.recording.uri ? [files.discard(e.recording.uri)] : [])),
    );
    void commit(current.current.filter((entry) => liveSetIds.has(entry.setId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, liveSetIds]);

  const value = useMemo<Controller>(
    () => ({
      analyzer: analyzer ?? fallback,
      loaded,
      entryFor: (setId) => entries.find((entry) => entry.setId === setId),
      async save(setId, recording, analysis) {
        const previous = current.current.find((entry) => entry.setId === setId);
        const kept = recording.uri
          ? await files.keep(recording.uri, `${setId}-${Date.now()}`)
          : null;
        const entry: FormCheckEntry = {
          setId,
          recordedAt: new Date().toISOString(),
          recording: { ...recording, uri: kept },
          analysis,
        };
        await commit([...current.current.filter((e) => e.setId !== setId), entry]);
        if (previous?.recording.uri && previous.recording.uri !== kept)
          await files.discard(previous.recording.uri);
      },
      async remove(setId) {
        const previous = current.current.find((entry) => entry.setId === setId);
        await commit(current.current.filter((entry) => entry.setId !== setId));
        if (previous?.recording.uri) await files.discard(previous.recording.uri);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analyzer, fallback, loaded, entries],
  );
  return <FormCheckContext.Provider value={value}>{children}</FormCheckContext.Provider>;
}
