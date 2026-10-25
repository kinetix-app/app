import { z } from 'zod/v4';

const decimal = (max: number, places: number) =>
  z
    .string()
    .regex(new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`))
    .refine((value) => Number(value) > 0 && Number(value) <= max);
export const weightUnitSchema = z.enum(['kg', 'lb']);
export const pictureUrlSchema = z.url({ protocol: /^https$/ }).max(2048);
export const objectiveSchema = z.enum([
  'build_muscle',
  'lose_fat',
  'gain_weight',
  'maintain_weight',
]);
export const objectiveResponseSchema = z.object({ objective: objectiveSchema.nullable() });
export type Objective = z.infer<typeof objectiveSchema>;

export const accountSchema = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  status: z.literal('active'),
  created_at: z.iso.datetime({ offset: true }),
  onboarding: z.object({
    profile_complete: z.boolean(),
    objective_selected: z.boolean(),
    required: z.boolean(),
  }),
  profile: z.object({
    display_name: z.string().nullable(),
    timezone: z.string().nullable(),
    age: z.number().int().min(1).max(120).nullable(),
    height_cm: decimal(300, 2).nullable(),
    weight_kg: decimal(1000, 6).nullable(),
    weight_unit: weightUnitSchema.nullable(),
    picture_url: pictureUrlSchema.nullable(),
    updated_at: z.iso.datetime({ offset: true }),
  }),
});

export const profilePatchSchema = z
  .object({
    display_name: z.string().trim().min(1).max(100).nullable().optional(),
    timezone: z.string().nullable().optional(),
    age: z.number().int().min(1).max(120).nullable().optional(),
    height_cm: decimal(300, 2).nullable().optional(),
    weight_kg: decimal(1000, 6).nullable().optional(),
    weight_unit: weightUnitSchema.nullable().optional(),
    picture_url: pictureUrlSchema.nullable().optional(),
  })
  .strict();

export type Account = z.infer<typeof accountSchema>;
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
