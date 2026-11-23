import { z } from 'zod/v4';

const entityId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const relationshipSchema = z.enum(['self', 'none', 'outgoing', 'incoming', 'friends']);
export const personSchema = z.object({
  id: entityId,
  display_name: z.string().nullable(),
  has_picture: z.boolean().default(false),
});
export const personResultSchema = personSchema.extend({ relationship: relationshipSchema });
export const personProfileSchema = personResultSchema.extend({
  friend_count: z.number().int().nonnegative(),
});
export const personPageSchema = z.object({ items: z.array(personResultSchema) });
export const friendPageSchema = z.object({
  items: z.array(z.object({ user: personSchema, since: z.iso.datetime({ offset: true }) })),
  limit: z.number().int(),
  offset: z.number().int(),
});
const requestSchema = z.object({
  user: personSchema,
  created_at: z.iso.datetime({ offset: true }),
});
export const friendRequestsSchema = z.object({
  incoming: z.array(requestSchema),
  outgoing: z.array(requestSchema),
});
export const relationshipResponseSchema = z.object({
  user_id: entityId,
  relationship: relationshipSchema,
});

export type Relationship = z.infer<typeof relationshipSchema>;
export type Person = z.infer<typeof personSchema>;
export type PersonResult = z.infer<typeof personResultSchema>;
export type PersonProfile = z.infer<typeof personProfileSchema>;
export type FriendRequests = z.infer<typeof friendRequestsSchema>;
