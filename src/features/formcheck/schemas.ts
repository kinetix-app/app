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

/**
 * Landmarks of the analysed set, kept so the replay can draw the skeleton. Coordinates are 0–1 of
 * the video frame; `frames[i]` holds x, y for each of `joints` (null where the joint was not seen).
 */
export const poseTrackSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  joints: z.array(z.string()),
  t: z.array(z.number()),
  frames: z.array(z.array(z.number().nullable())),
  /** Each rep's time window and the joints involved in its faults (empty: no fault). */
  reps: z.array(z.object({ start: z.number(), end: z.number(), faultJoints: z.array(z.string()) })),
});
export type PoseTrack = z.infer<typeof poseTrackSchema>;

const analysisBase = {
  profileId: z.string(),
  analyzedAt: z.iso.datetime({ offset: true }),
  durationSeconds: z.number().nonnegative(),
  /** Which engine and spec produced the result, so old results can be told apart. */
  source: z
    .object({ engine: z.string(), spec: z.string(), specVersion: z.number().int() })
    .optional(),
  /** Absent in demo and older results. */
  pose: poseTrackSchema.optional(),
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
    /** 0–100 set score from the technique engine; absent in demo and older results. */
    score: z.number().min(0).max(100).optional(),
    /** Checks that were measured and passed on every rep, to praise; absent in older results. */
    strengths: z.array(z.string()).optional(),
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
