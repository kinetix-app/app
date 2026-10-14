import { z } from 'zod/v4';

export const accountSchema = z.object({
  id: z.uuid(),
  status: z.literal('active'),
  created_at: z.iso.datetime({ offset: true }),
  profile: z.object({
    display_name: z.string().nullable(),
    timezone: z.string().nullable(),
    updated_at: z.iso.datetime({ offset: true }),
  }),
});

export const profilePatchSchema = z
  .object({
    display_name: z.string().trim().min(1).max(100).nullable().optional(),
    timezone: z.string().nullable().optional(),
  })
  .strict();

export type Account = z.infer<typeof accountSchema>;
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
