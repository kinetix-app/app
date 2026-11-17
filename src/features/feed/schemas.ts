import { z } from 'zod/v4';

const entityId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const count = z.number().int().nonnegative();

export const MAX_POST_TEXT = 2200;
export const MAX_COMMENT_TEXT = 1000;
export const MAX_POST_IMAGES = 5;
export const MAX_POST_IMAGE_BYTES = 5 * 1024 * 1024;
export const POST_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Only the authenticated media route is ever requested; never an arbitrary server URL. */
export const mediaPathSchema = z.string().regex(/^\/api\/v1\/posts\/\d+\/media\/\d+$/);

export const postAuthorSchema = z.object({
  id: entityId,
  display_name: z.string().nullable(),
  has_picture: z.boolean().default(false),
});

export const workoutSummarySchema = z.object({
  session_id: entityId,
  activity_type: z.string(),
  started_at: z.iso.datetime({ offset: true }),
  ended_at: z.iso.datetime({ offset: true }),
  duration_seconds: count,
  exercise_count: count,
  set_count: count,
  total_reps: count,
  // Decimal text in kilograms, rounded by the backend to 0.01 kg.
  total_volume_kg: z.string().regex(/^\d+(\.\d+)?$/),
  exercises: z.array(z.string()),
});

export const postSchema = z.object({
  id: entityId,
  text: z.string(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE', 'LEAGUE']),
  type: z.enum(['SESSION', 'LEAGUE_PENALTY', 'GENERAL']),
  created_at: z.iso.datetime({ offset: true }),
  author: postAuthorSchema,
  workout: workoutSummarySchema.nullable(),
  media: z.array(
    z.object({
      id: entityId,
      type: z.enum(['IMAGE', 'VIDEO']),
      order: z.number().int(),
      url: mediaPathSchema,
    }),
  ),
  like_count: count,
  comment_count: count,
  liked_by_me: z.boolean(),
  is_mine: z.boolean(),
});

export const postPageSchema = z.object({
  items: z.array(postSchema),
  next_before_id: entityId.nullable(),
});

export const likeSchema = z.object({ liked: z.boolean(), like_count: count });

export const commentSchema = z.object({
  id: entityId,
  post_id: entityId,
  author: postAuthorSchema,
  comment: z.string(),
  created_at: z.iso.datetime({ offset: true }),
  is_mine: z.boolean(),
});

export const commentPageSchema = z.object({
  items: z.array(commentSchema),
  next_after_id: entityId.nullable(),
});

export const commentInputSchema = z.object({
  comment: z.string().trim().min(1).max(MAX_COMMENT_TEXT),
});

export type Post = z.infer<typeof postSchema>;
export type PostPage = z.infer<typeof postPageSchema>;
export type WorkoutSummary = z.infer<typeof workoutSummarySchema>;
export type Comment = z.infer<typeof commentSchema>;
export type CommentPage = z.infer<typeof commentPageSchema>;
export type PostVisibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
