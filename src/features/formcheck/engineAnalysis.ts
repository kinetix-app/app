import { ENGINE_VERSION, type EngineResult, type UnassessableReason } from './engine';
import { failed } from './poseTrack';
import type { FormCheckProfile } from './profiles';
import type { FormAnalysis, PoseTrack, Recording } from './schemas';

/** Engine reasons → the app's not-assessable reason ids (wording lives in reasons.ts). */
function reasonIds(result: Extract<EngineResult, { assessable: false }>): string[] {
  const map: Record<UnassessableReason, string> = {
    too_short: 'too_short',
    not_side_view: 'wrong_angle',
    missing_joints: 'body_not_visible',
    low_confidence: 'low_confidence',
    no_reps: 'no_reps_detected',
  };
  if (result.reason === 'missing_joints' && result.detail.joints?.includes('hip'))
    return ['hips_not_visible'];
  return [map[result.reason]];
}

/** Criteria measured on at least one rep and failed on none, in spec order. */
function strengths(result: Extract<EngineResult, { assessable: true }>): string[] {
  const ids = Object.keys(result.reps[0]?.criteria ?? {});
  return ids.filter((id) => {
    const per = result.reps.map((rep) => rep.criteria[id]);
    return per.every((c) => !c?.disabled && !failed(c)) && per.some((c) => c && c.sub !== null);
  });
}

/**
 * Turns a technique-engine result into the app's FormAnalysis. A rep's issues are the criteria it
 * failed (sub-score below the fault line); disabled criteria never appear.
 */
export function toFormAnalysis(
  result: EngineResult,
  profile: FormCheckProfile,
  recording: Recording,
  analyzedAt: Date = new Date(),
  pose?: PoseTrack,
): FormAnalysis {
  const base = {
    profileId: profile.id,
    analyzedAt: analyzedAt.toISOString(),
    durationSeconds: recording.durationSeconds,
    ...(pose ? { pose } : {}),
  };
  if (!result.assessable) return { ...base, status: 'not_assessable', reasons: reasonIds(result) };
  return {
    ...base,
    source: { engine: ENGINE_VERSION, spec: result.exercise, specVersion: result.spec_version },
    status: 'assessed',
    score: result.feedback.score,
    strengths: strengths(result),
    reps: result.reps.map((rep) => ({
      index: rep.rep,
      issues: Object.entries(rep.criteria)
        .filter(([, c]) => failed(c))
        .map(([id]) => id),
    })),
  };
}
