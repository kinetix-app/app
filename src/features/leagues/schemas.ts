import { z } from 'zod/v4';

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const leaguePicturePathSchema = z
  .string()
  .regex(/^\/api\/v1\/leagues\/[1-9]\d*\/picture(?:\?v=[a-zA-Z0-9-]+)?$/);
export const memberPicturePathSchema = z
  .string()
  .regex(/^\/api\/v1\/leagues\/[1-9]\d*\/members\/[1-9]\d*\/picture(?:\?v=[a-zA-Z0-9-]+)?$/);
export const memberPictureSchema = z.union([
  memberPicturePathSchema,
  z.url({ protocol: /^https$/ }).max(2048),
]);
export const leagueSchema = z.object({
  id,
  name: z.string(),
  picture_url: leaguePicturePathSchema.nullable().default(null),
  timezone: z.string().nullable(),
  role: z.string().nullable(),
});
export const leagueDetailSchema = leagueSchema.extend({
  created_at: z.string(),
  members: z.array(
    z.object({
      user_id: id,
      display_name: z.string().nullable(),
      picture_url: memberPictureSchema.nullable().default(null),
      role: z.string().nullable(),
      joined_at: z.string().nullable(),
    }),
  ),
});
export const createdLeagueSchema = leagueSchema.extend({ created_at: z.string() });
export const invitationSchema = z.object({ token: z.string().min(1), expires_at: z.string() });
export const previewSchema = z.object({ league_id: id, name: z.string(), expires_at: z.string() });
export const nameSchema = z.string().trim().min(1, 'Enter a league name.').max(200);
export const createSchema = z.object({
  name: nameSchema,
  timezone: z
    .string()
    .trim()
    .min(1, 'Enter a timezone.')
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, 'Enter a valid IANA timezone.'),
});
export const leagueListItemSchema = leagueSchema.extend({
  member_count: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  current_week_position: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
});
export const leagueListSchema = z.array(leagueListItemSchema);
export function invitationToken(value: string) {
  const input = value.trim();
  if (!input) return '';
  try {
    const url = new URL(input);
    return decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '');
  } catch {
    return input;
  }
}

const integerString = z.string().regex(/^\d+$/);
const decimalString = z.string().regex(/^\d+(?:\.\d+)?$/);
export const standingSchema = z.object({
  user_id: id,
  display_name: z.string().nullable(),
  picture_url: memberPictureSchema.nullable().default(null),
  score: integerString,
  position: z.number().int().positive(),
});
export const standingsSchema = z.object({
  timezone: z.string(),
  current_round_id: id,
  rounds: z.array(
    z.object({
      id,
      start_at: z.string(),
      end_at: z.string(),
      standings: z.array(standingSchema),
      contributions: z.array(
        z.object({
          user_id: id,
          local_day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          score: integerString,
          calculation: z
            .object({
              session_id: id,
              volume_kg_reps: decimalString,
              duration_us: integerString,
              body_weight_kg: decimalString,
              formula_version: z.string(),
            })
            .optional(),
        }),
      ),
    }),
  ),
  general: z.array(standingSchema),
});
export type Standings = z.infer<typeof standingsSchema>;

export const pendingResultsSchema = z.array(
  z.object({
    id,
    round_id: id,
    start_at: z.string(),
    end_at: z.string(),
    standings: z.array(standingSchema),
    loser_user_ids: z.array(id),
  }),
);
export type PendingResult = z.infer<typeof pendingResultsSchema>[number];

export type LeagueDetail = z.infer<typeof leagueDetailSchema>;
