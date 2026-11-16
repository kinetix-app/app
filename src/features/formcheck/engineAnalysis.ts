import { ENGINE_VERSION, type EngineResult, type UnassessableReason } from './engine';
import { FAULT_BELOW } from './engine/scoring';
import type { FormCheckProfile } from './profiles';
import type { FormAnalysis, Recording } from './schemas';

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

/**
 * Turns a technique-engine result into the app's FormAnalysis. A rep's issues are the criteria it
 * failed (sub-score below the fault line); disabled criteria never appear.
 */
export function toFormAnalysis(
  result: EngineResult,
  profile: FormCheckProfile,
  recording: Recording,
  analyzedAt: Date = new Date(),
): FormAnalysis {
  const base = {
    profileId: profile.id,
    analyzedAt: analyzedAt.toISOString(),
    durationSeconds: recording.durationSeconds,
  };
  if (!result.assessable) return { ...base, status: 'not_assessable', reasons: reasonIds(result) };
  return {
    ...base,
    source: { engine: ENGINE_VERSION, spec: result.exercise, specVersion: result.spec_version },
    status: 'assessed',
    score: result.feedback.score,
    reps: result.reps.map((rep) => ({
      index: rep.rep,
      issues: Object.entries(rep.criteria)
        .filter(([, c]) => !c.disabled && c.sub !== null && c.sub < FAULT_BELOW)
        .map(([id]) => id),
    })),
  };
}
