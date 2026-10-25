import { z } from 'zod/v4';

export const entityId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const weightUnitSchema = z.enum(['kg', 'lb']);
export const weightSchema = z.object({
  value: z.string(),
  unit: weightUnitSchema,
});
const nullableStrings = z.array(z.string()).nullable();
export const exerciseSummarySchema = z.object({
  id: entityId,
  name: z.string(),
  activity_type: z.string(),
  body_parts: nullableStrings,
  target_muscles: nullableStrings,
  equipments: nullableStrings,
  image_url: z.string().nullable(),
});
export const bodyPartsSchema = z.object({ items: z.array(z.string()) });
export const exerciseSchema = z.object({
  id: entityId,
  name: z.string(),
  activity_type: z.string(),
  overview: z.string().nullable(),
  target_muscles: nullableStrings,
  secondary_muscles: nullableStrings,
  body_parts: nullableStrings,
  equipments: nullableStrings,
  instructions: nullableStrings,
  image_url: z.string().nullable(),
  video_url: z.string().nullable(),
});
export const setSchema = z.object({
  set_number: z.number().int().positive(),
  reps: z.number().int().nullable(),
  weight_kg: z.string().nullable(),
  weight: weightSchema.nullable().optional(),
  duration_seconds: z.number().int().nullable(),
  distance_km: z.string().nullable(),
});
export const slotSchema = z.object({
  id: entityId,
  exercise_order: z.number().int().positive(),
  exercise: exerciseSchema,
  notes: z.string().nullable(),
  default_sets: z.array(setSchema),
  sets: z.array(setSchema),
  sets_source: z.enum(['routine', 'latest_session']),
});
export const routineSummarySchema = z.object({
  id: entityId,
  name: z.string(),
});
export const routineSchema = routineSummarySchema.extend({
  exercises: z.array(slotSchema),
});
export const exercisePageSchema = z.object({
  items: z.array(exerciseSummarySchema),
  limit: z.number().int(),
  offset: z.number().int(),
});
export const routinePageSchema = z.object({
  items: z.array(routineSummarySchema),
  limit: z.number().int(),
  offset: z.number().int(),
});
const decimalWeightSchema = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, 'Use decimal text with at most six decimals.');
export function validWeight(value: string, unit: 'kg' | 'lb', decimals = 6) {
  return (
    new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`).test(value) &&
    Number(value) * (unit === 'lb' ? 0.45359237 : 1) <= 999999.99
  );
}
export const weightInputSchema = z
  .object({ value: decimalWeightSchema, unit: weightUnitSchema })
  .refine((v) => validWeight(v.value, v.unit), 'Weight must be between 0 and 999999.99 kg.');
export const plannedSetSchema = z.union([
  z.strictObject({
    reps: z.number().int().min(1).max(2147483647),
    weight_kg: decimalWeightSchema.refine((v) => validWeight(v, 'kg'), 'Weight is too large.'),
  }),
  z.strictObject({ reps: z.number().int().min(1).max(2147483647), weight: weightInputSchema }),
]);
export const routineInputSchema = z.object({
  name: z.string().trim().min(1, 'Enter a routine name.').max(150),
  exercises: z
    .array(
      z.object({
        id: entityId.optional(),
        exercise_id: entityId,
        sets: z.array(plannedSetSchema).max(100).optional(),
      }),
    )
    .min(1, 'Add at least one exercise.')
    .max(500),
});
export type ExerciseSummary = z.infer<typeof exerciseSummarySchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type Routine = z.infer<typeof routineSchema>;
export type RoutineInput = z.infer<typeof routineInputSchema>;

export const completionInputSchema = z
  .object({
    client_session_id: z.string().uuid(),
    routine_id: entityId.nullable().optional(),
    started_at: z.iso.datetime({ offset: true }),
    ended_at: z.iso.datetime({ offset: true }),
    exercises: z
      .array(
        z.object({
          exercise_id: entityId,
          sets: z
            .array(
              z.object({
                reps: z.number().int().min(1).max(2147483647),
                weight: weightInputSchema,
              }),
            )
            .max(100),
        }),
      )
      .max(500),
  })
  .refine((v) => Date.parse(v.ended_at) >= Date.parse(v.started_at), 'End must follow start.');
export const completedSessionSchema = z.object({
  id: entityId,
  client_session_id: z.string().uuid().nullable(),
  routine_id: entityId.nullable(),
  activity_type: z.string(),
  state: z.literal('completed'),
  started_at: z.iso.datetime({ offset: true }),
  ended_at: z.iso.datetime({ offset: true }),
  exercises: z.array(
    z.object({
      id: entityId,
      exercise_order: z.number().int().positive(),
      exercise: exerciseSchema,
      sets: z.array(setSchema.extend({ weight: weightSchema.nullable() })),
    }),
  ),
});
export const sessionPageSchema = z.object({
  items: z.array(completedSessionSchema),
  limit: z.number().int(),
  offset: z.number().int(),
});
export type WeightUnit = z.infer<typeof weightUnitSchema>;
export type CompletionInput = z.infer<typeof completionInputSchema>;
export type CompletedSession = z.infer<typeof completedSessionSchema>;

export const draftSnapshotSchema = z.object({
  routine_id: entityId.nullable(),
  name: z.string().min(1).max(150),
  started_at: z.iso.datetime({ offset: true }),
  exercises: z
    .array(
      z.object({
        client_id: z.string().uuid(),
        exercise_id: entityId,
        sets: z
          .array(
            z.object({
              client_id: z.string().uuid(),
              reps: z.number().int().min(1).max(2147483647).nullable(),
              weight: weightInputSchema.nullable(),
              completed: z.boolean(),
            }),
          )
          .max(100),
      }),
    )
    .max(500),
});
export const serverDraftSchema = draftSnapshotSchema.extend({
  client_session_id: z.string().uuid(),
  state: z.literal('draft'),
});
export type DraftSnapshot = z.infer<typeof draftSnapshotSchema>;
export type ServerDraft = z.infer<typeof serverDraftSchema>;

export const exerciseConfigurationSchema = z.object({
  exercise_id: entityId,
  sets: z.array(setSchema),
});
export type ExerciseConfiguration = z.infer<typeof exerciseConfigurationSchema>;
