import { z } from 'zod/v4';

/** What the camera captured. `uri` is null when the platform cannot keep the video. */
export const recordingSchema = z.object({
  uri: z.string().nullable(),
  durationSeconds: z.number().nonnegative(),
});
export type Recording = z.infer<typeof recordingSchema>;

/** One repetition and the ids of the profile checks it failed. Empty means it looked fine. */
export const repResultSchema = z.object({
  index: z.number().int().positive(),
  issues: z.array(z.string()),
});
export type RepResult = z.infer<typeof repResultSchema>;

const analysisBase = {
  profileId: z.string(),
  analyzedAt: z.iso.datetime({ offset: true }),
  durationSeconds: z.number().nonnegative(),
};
/**
 * Result of analysing one recorded set. Ids refer to a form-check profile: the analyzer says
 * which checks failed and which input problems it found, and the profile owns the wording.
 */
export const formAnalysisSchema = z.discriminatedUnion('status', [
  z.object({
    ...analysisBase,
    status: z.literal('assessed'),
    reps: z.array(repResultSchema).min(1),
  }),
  z.object({
    ...analysisBase,
    status: z.literal('not_assessable'),
    reasons: z.array(z.string()).min(1),
  }),
]);
export type FormAnalysis = z.infer<typeof formAnalysisSchema>;

/** What the app keeps for one recorded set. */
export const formCheckEntrySchema = z.object({
  setId: z.string(),
  recordedAt: z.iso.datetime({ offset: true }),
  recording: recordingSchema,
  analysis: formAnalysisSchema,
});
export type FormCheckEntry = z.infer<typeof formCheckEntrySchema>;
export const formCheckEntriesSchema = z.object({
  version: z.literal(1),
  entries: z.array(formCheckEntrySchema),
});
