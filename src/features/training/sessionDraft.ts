import { z } from 'zod/v4';
import { randomUUID } from 'expo-crypto';
import {
  completionInputSchema,
  entityId,
  exerciseSummarySchema,
  weightUnitSchema,
  type CompletionInput,
  type Routine,
  type DraftSnapshot,
  type ServerDraft,
  type WeightUnit,
} from './schemas';

const actualSetSchema = z.object({
  id: z.string(),
  reps: z.string(),
  value: z.string(),
  unit: weightUnitSchema,
  saved: z.boolean().optional(),
  confirmed: z.object({ value: z.string(), reps: z.string(), unit: weightUnitSchema }).optional(),
  drafted: z.object({ value: z.string(), reps: z.string(), unit: weightUnitSchema }).optional(),
});
export const sessionDraftSchema = z.object({
  version: z.literal(1),
  accountId: entityId,
  clientId: z.uuid(),
  startedAt: z.iso.datetime({ offset: true }),
  routineId: entityId.nullable(),
  name: z.string(),
  minimized: z.boolean(),
  displayUnit: weightUnitSchema,
  exercises: z
    .array(
      z.object({
        id: z.string(),
        exercise: exerciseSummarySchema,
        guidance: z.array(
          z.object({
            reps: z.number().int().nullable(),
            weightKg: z.string().nullable(),
          }),
        ),
        sets: z.array(actualSetSchema).max(100),
      }),
    )
    .max(500),
  frozen: completionInputSchema.nullable(),
  updateRoutine: z.boolean().optional(),
});
export type SessionDraft = z.infer<typeof sessionDraftSchema>;
export type ActualSet = z.infer<typeof actualSetSchema>;
export const emptyActualSet = (unit: WeightUnit): ActualSet => ({
  id: randomUUID(),
  reps: '',
  value: '',
  unit,
});
export function createSessionDraft(accountId: number, routine?: Routine): SessionDraft {
  return {
    version: 1,
    accountId,
    clientId: randomUUID(),
    startedAt: new Date().toISOString(),
    routineId: routine?.id ?? null,
    name: routine?.name ?? 'Workout',
    minimized: false,
    displayUnit: 'kg',
    frozen: null,
    exercises:
      routine?.exercises.map((slot) => ({
        id: randomUUID(),
        exercise: exerciseSummarySchema.parse(slot.exercise),
        guidance: slot.sets.map((set) => ({
          reps: set.reps,
          weightKg: set.weight_kg,
        })),
        sets: (slot.sets.length ? slot.sets : [null]).map(() => emptyActualSet('kg')),
      })) ?? [],
  };
}
/** Convert only for presentation. The original entered decimal/unit is never replaced on toggles. */
export function displayWeight(value: string, source: WeightUnit, target: WeightUnit): string {
  if (!value.trim() || source === target) return value;
  if (!/^\d+(\.\d{0,6})?$/.test(value)) return value;
  return (Number(value) * (source === 'lb' ? 0.45359237 : 1 / 0.45359237)).toFixed(2);
}
/** Freeze explicit saved results; unfinished fields are omitted without losing exercise order. */
export function freezeSession(
  draft: SessionDraft,
  endedAt = new Date().toISOString(),
): CompletionInput {
  if (draft.frozen) return draft.frozen;
  return completionInputSchema.parse({
    client_session_id: draft.clientId,
    routine_id: draft.routineId,
    started_at: draft.startedAt,
    ended_at: endedAt,
    exercises: draft.exercises.map((slot) => ({
      exercise_id: slot.exercise.id,
      sets: slot.sets
        .filter((set) => set.saved)
        .map((set) => ({
          reps: /^\d+$/.test(set.reps) ? Number(set.reps) : Number.NaN,
          weight: { value: set.value, unit: set.unit },
        })),
    })),
  });
}

/** Publish tick/untick values while keeping subsequent unsent field edits local. */
export function draftSnapshot(draft: SessionDraft, savedOnly = false): DraftSnapshot {
  return {
    routine_id: draft.routineId,
    name: draft.name,
    started_at: draft.startedAt,
    exercises: draft.exercises.map((slot) => ({
      client_id: slot.id,
      exercise_id: slot.exercise.id,
      sets: slot.sets
        .filter((set) => !savedOnly || set.saved)
        .map((set) => {
          const confirmed = set.saved ? set : set.confirmed;
          const persisted = confirmed ?? set.drafted;
          return {
            client_id: set.id,
            completed: Boolean(confirmed),
            reps: persisted ? Number(persisted.reps) : null,
            weight: persisted ? { value: persisted.value, unit: persisted.unit } : null,
          };
        }),
    })),
  };
}
export async function restoreServerDraft(
  accountId: number,
  server: ServerDraft,
  local: SessionDraft | null,
  exercise: (id: number) => Promise<z.infer<typeof exerciseSummarySchema>>,
): Promise<SessionDraft> {
  if (local?.clientId === server.client_session_id) return local;
  return {
    version: 1,
    accountId,
    clientId: server.client_session_id,
    routineId: server.routine_id,
    startedAt: server.started_at,
    name: server.name,
    minimized: true,
    displayUnit: 'kg',
    frozen: null,
    exercises: await Promise.all(
      server.exercises.map(async (slot) => ({
        id: slot.client_id,
        exercise: await exercise(slot.exercise_id),
        guidance: [],
        sets: slot.sets.map((set) => ({
          id: set.client_id,
          reps: set.reps === null ? '' : String(set.reps),
          value: set.weight?.value ?? '',
          unit: set.weight?.unit ?? 'kg',
          saved: set.completed,
          ...(set.weight && set.reps !== null
            ? {
                [set.completed ? 'confirmed' : 'drafted']: {
                  value: set.weight.value,
                  reps: String(set.reps),
                  unit: set.weight.unit,
                },
              }
            : {}),
        })),
      })),
    ),
  };
}
