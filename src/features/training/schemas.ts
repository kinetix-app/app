import { z } from 'zod/v4';

export const entityId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
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
export const routineSummarySchema = z.object({ id: entityId, name: z.string() });
export const routineSchema = routineSummarySchema.extend({ exercises: z.array(slotSchema) });
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
export const plannedSetSchema = z.object({
  reps: z.number().int().min(1).max(2147483647),
  weight_kg: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Use kilograms with at most two decimals.')
    .refine((v) => Number(v) <= 999999.99, 'Weight is too large.'),
});
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
