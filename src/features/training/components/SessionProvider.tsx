import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { trainingApi } from '../api';
import {
  createSessionDraft,
  emptyActualSet,
  draftSnapshot,
  freezeSession,
  restoreServerDraft,
  type SessionDraft,
} from '../sessionDraft';
import { sessionStorage } from '../sessionStorage';
import { randomUUID } from 'expo-crypto';
import { validWeight, type Routine, type ExerciseSummary } from '../schemas';

type Controller = {
  accountId: number;
  draft: SessionDraft | null;
  ready: boolean;
  pending: boolean;
  error: string;
  storageError: boolean;
  start: (routine?: Routine) => void;
  change: (edit: (draft: SessionDraft) => SessionDraft) => void;
  saveSet: (slotId: string, setId: string) => Promise<boolean>;
  sync: () => Promise<void>;
  finish: (updateRoutine?: boolean) => Promise<void>;
  addExercise: (exercise: ExerciseSummary) => Promise<string | null>;
  discard: () => Promise<void>;
  retryStorage: () => Promise<void>;
  signOut: () => Promise<void>;
};
const SessionContext = createContext<Controller | null>(null);
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('Session provider missing.');
  return value;
}
export function SessionProvider({
  accountId,
  onSignOut,
  children,
}: React.PropsWithChildren<{ accountId: number; onSignOut: () => void }>) {
  const cache = useQueryClient();
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const current = useRef<SessionDraft | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);
  const closing = useRef(false);
  const request = useRef<AbortController | null>(null);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const install = (value: SessionDraft | null) => {
    current.current = value;
    setDraft(value);
  };
  async function restore(signal?: AbortSignal) {
    const local = await sessionStorage.load(accountId);
    const server = await trainingApi.draft(signal);
    const value = server
      ? await restoreServerDraft(accountId, server, local, (id) => trainingApi.exercise(id, signal))
      : local;
    if (!alive.current || signal?.aborted) return;
    install(value);
    setReady(true);
    setStorageError(false);
    setError('');
  }
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    request.current = controller;
    void restore(controller.signal).catch(() => {
      if (alive.current && !controller.signal.aborted) {
        setStorageError(true);
        setError('Could not restore your workout. Check your connection and retry.');
      }
    });
    return () => {
      alive.current = false;
      controller.abort();
      request.current?.abort();
      current.current = null;
    };
    // Account boundary owns restoration; draft edits must not trigger a new hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);
  function showStorageError() {
    if (alive.current) {
      setStorageError(true);
      setError('Could not save your workout on this device. Keep the app open and retry storage.');
    }
  }
  function change(edit: (draft: SessionDraft) => SessionDraft) {
    const previous = current.current;
    if (!previous || closing.current || busy.current) return;
    const next = edit(previous);
    if (
      previous.frozen &&
      (next.exercises !== previous.exercises || next.frozen !== previous.frozen)
    )
      return;
    // Any changed result becomes unsaved, even if a caller forgets to clear the tick.
    const normalized = {
      ...next,
      exercises: next.exercises.map((slot) => ({
        ...slot,
        sets: slot.sets.map((set) => {
          const old = previous.exercises
            .find((value) => value.id === slot.id)
            ?.sets.find((value) => value.id === set.id);
          return old && (old.value !== set.value || old.reps !== set.reps || old.unit !== set.unit)
            ? { ...set, saved: false }
            : set;
        }),
      })),
    };
    install(normalized);
    void sessionStorage.save(normalized).catch(showStorageError);
  }
  async function persist(value: SessionDraft, savedOnly = false) {
    await trainingApi.saveDraft(
      value.clientId,
      draftSnapshot(value, savedOnly),
      request.current?.signal,
    );
    if (!alive.current || closing.current) return;
    const confirmed = {
      ...value,
      exercises: value.exercises.map((slot) => ({
        ...slot,
        sets: slot.sets.map((set) =>
          set.saved
            ? {
                ...set,
                drafted: undefined,
                confirmed: { value: set.value, reps: set.reps, unit: set.unit },
              }
            : set,
        ),
      })),
    };
    install(confirmed);
    await sessionStorage.save(confirmed);
  }
  async function syncValue(value: SessionDraft) {
    if (busy.current || closing.current || value.frozen) return false;
    busy.current = true;
    setPending(true);
    setError('');
    request.current = new AbortController();
    try {
      await persist(value);
      return alive.current && !closing.current;
    } catch {
      if (alive.current && !closing.current)
        setError(
          'Could not save the workout. Your changes are retained. Retry the tick or Sync workout.',
        );
      return false;
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }
  function start(routine?: Routine) {
    if (!ready || closing.current || busy.current || (storageError && !current.current)) return;
    if (current.current) return;
    const value = createSessionDraft(accountId, routine);
    install(value);
    void sessionStorage.save(value).catch(showStorageError);
    void syncValue(value);
  }
  async function sync() {
    if (current.current) await syncValue(current.current);
  }
  async function saveSet(slotId: string, setId: string) {
    const value = current.current;
    if (!value || value.frozen || busy.current) return false;
    const slot = value.exercises.find((slot) => slot.id === slotId);
    const index = slot?.sets.findIndex((set) => set.id === setId) ?? -1;
    const original = slot?.sets[index];
    if (!original) return false;
    const guidance = slot?.guidance[index];
    const useSuggestedWeight =
      !original.saved && original.value === '' && guidance?.weightKg != null;
    const target = original.saved
      ? original
      : {
          ...original,
          value: useSuggestedWeight ? Number(guidance.weightKg).toFixed(2) : original.value,
          unit: useSuggestedWeight ? ('kg' as const) : original.unit,
          reps:
            original.reps === '' && guidance?.reps != null ? String(guidance.reps) : original.reps,
        };
    if (
      !target.saved &&
      (!validWeight(target.value, target.unit) ||
        !/^\d+$/.test(target.reps) ||
        Number(target.reps) < 1 ||
        Number(target.reps) > 2147483647)
    ) {
      setError('Enter a nonnegative weight and positive whole repetitions before saving this set.');
      return false;
    }
    if (target.value !== original.value || target.reps !== original.reps) {
      change((draft) => ({
        ...draft,
        exercises: draft.exercises.map((slot) =>
          slot.id === slotId
            ? { ...slot, sets: slot.sets.map((set) => (set.id === setId ? target : set)) }
            : slot,
        ),
      }));
    }
    return await syncValue({
      ...value,
      exercises: value.exercises.map((slot) =>
        slot.id !== slotId
          ? slot
          : {
              ...slot,
              sets: slot.sets.map((set) =>
                set.id === setId
                  ? {
                      ...target,
                      saved: !target.saved,
                      ...(target.saved
                        ? {
                            confirmed: undefined,
                            drafted: { value: set.value, reps: set.reps, unit: set.unit },
                          }
                        : {}),
                    }
                  : set,
              ),
            },
      ),
    });
  }
  async function addExercise(exercise: ExerciseSummary): Promise<string | null> {
    const value = current.current;
    if (!value || value.frozen || busy.current || closing.current || value.exercises.length >= 500)
      return null;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const configuration = await cache.fetchQuery({
        queryKey: ['training', accountId, 'exercise-configuration', exercise.id, 'kg'],
        queryFn: ({ signal }) => trainingApi.lastConfiguration(exercise.id, signal),
        staleTime: 0,
        retry: false,
      });
      if (!alive.current || closing.current || current.current?.clientId !== value.clientId)
        return null;
      const id = randomUUID();
      const next = {
        ...value,
        exercises: [
          ...value.exercises,
          {
            id,
            exercise,
            guidance: configuration.sets.map((set) => ({
              reps: set.reps,
              weightKg: set.weight_kg,
            })),
            sets: (configuration.sets.length ? configuration.sets : [null]).map(() =>
              emptyActualSet('kg'),
            ),
          },
        ],
      };
      install(next);
      try {
        await sessionStorage.save(next);
      } catch {
        showStorageError();
      }
      return id;
    } catch {
      if (alive.current && !closing.current)
        setError('Could not load previous sets. Retry adding the exercise.');
      return null;
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }
  async function retryStorage() {
    try {
      if (!ready) await restore();
      else if (current.current) await sessionStorage.save(current.current);
      else await sessionStorage.clear(accountId);
      if (alive.current) {
        setStorageError(false);
        setError('');
      }
    } catch {
      showStorageError();
    }
  }
  async function discard() {
    if (busy.current || current.current?.frozen) return;
    busy.current = true;
    setPending(true);
    request.current = new AbortController();
    try {
      if (current.current)
        await trainingApi.discardDraft(current.current.clientId, request.current.signal);
      else {
        const server = await trainingApi.draft(request.current.signal);
        if (server)
          await trainingApi.discardDraft(server.client_session_id, request.current.signal);
      }
      await sessionStorage.clear(accountId);
      if (alive.current) {
        install(null);
        setError('');
        setStorageError(false);
        setReady(true);
      }
    } catch {
      if (alive.current) setError('Could not discard the workout. It is retained; try again.');
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }
  async function finish(updateRoutine = false) {
    const value = current.current;
    if (!value || busy.current || closing.current || storageError) return;
    let frozen;
    try {
      frozen = freezeSession(value);
    } catch {
      setError('Complete every set before finishing.');
      return;
    }
    busy.current = true;
    setPending(true);
    setError('');
    request.current = new AbortController();
    try {
      // Sync structure first. Once frozen, retries call finish only: completed drafts cannot be edited.
      if (!value.frozen) await persist(value, true);
      if (!alive.current || closing.current) return;
      const snapshot = {
        ...value,
        frozen,
        updateRoutine: value.frozen ? (value.updateRoutine ?? false) : updateRoutine,
      };
      await sessionStorage.save(snapshot);
      install(snapshot);
      await trainingApi.finishDraft(
        value.clientId,
        frozen.ended_at,
        request.current.signal,
        snapshot.updateRoutine,
      );
      if (!alive.current || closing.current) return;
      await sessionStorage.clear(accountId);
      if (!alive.current) return;
      install(null);
      await cache.invalidateQueries({ queryKey: ['training', accountId] });
    } catch {
      if (alive.current && !closing.current)
        setError('Could not finish the workout. Your results are retained. Retry Finish safely.');
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }
  async function signOut() {
    if (closing.current) return;
    closing.current = true;
    request.current?.abort();
    try {
      await sessionStorage.clear(accountId);
      if (alive.current) {
        install(null);
        onSignOut();
      }
    } catch {
      closing.current = false;
      showStorageError();
    }
  }
  return (
    <SessionContext.Provider
      value={{
        accountId,
        draft,
        ready,
        pending,
        error,
        storageError,
        start,
        change,
        saveSet,
        sync,
        finish,
        addExercise,
        discard,
        retryStorage,
        signOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
