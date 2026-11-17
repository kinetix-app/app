import { IDX, type EngineResult, type ExerciseSpec, type PoseSeries } from './engine';
import { FAULT_BELOW, type CriterionResult } from './engine/scoring';
import type { PoseTrack } from './schemas';

/** Joints drawn over the replay: the body, both sides, without the face and hands. */
export const TRACK_JOINTS = [
  'left_ear',
  'right_ear',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
  'left_heel',
  'right_heel',
  'left_foot_index',
  'right_foot_index',
] as const;

export const BONES: readonly (readonly [string, string])[] = (['left', 'right'] as const).flatMap(
  (s) => [
    [`${s}_ear`, `${s}_shoulder`],
    [`${s}_shoulder`, `${s}_elbow`],
    [`${s}_elbow`, `${s}_wrist`],
    [`${s}_shoulder`, `${s}_hip`],
    [`${s}_hip`, `${s}_knee`],
    [`${s}_knee`, `${s}_ankle`],
    [`${s}_ankle`, `${s}_heel`],
    [`${s}_heel`, `${s}_foot_index`],
    [`${s}_ankle`, `${s}_foot_index`],
  ],
);

const MIN_VISIBILITY = 0.5;
const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** A criterion the rep failed: the same rule the result screen uses to list issues. */
export function failed(c: CriterionResult | undefined): boolean {
  return !!c && !c.disabled && c.sub !== null && c.sub < FAULT_BELOW;
}

/**
 * The landmarks the analysis saw, compacted for storage, plus where each rep went wrong, so the
 * replay can draw the skeleton and mark the joints of each fault.
 */
export function buildPoseTrack(
  series: PoseSeries,
  result: EngineResult,
  spec: ExerciseSpec,
): PoseTrack {
  const indexes = TRACK_JOINTS.map((j) => IDX[j]);
  const frames = series.xy.map((frame, f) =>
    indexes.flatMap((i) => {
      const [x, y] = frame[i];
      const seen =
        Number.isFinite(x) && Number.isFinite(y) && series.visibility[f][i] >= MIN_VISIBILITY;
      return seen ? [round3(x), round3(y)] : [null, null];
    }),
  );
  const reps = result.assessable
    ? result.reps.map((rep) => ({
        start: rep.start_s,
        end: rep.end_s,
        faultJoints: [
          ...new Set(
            spec.criteria
              .filter((c) => failed(rep.criteria[c.id]))
              .flatMap((c) => c.points.map((point) => `${result.side}_${point}`)),
          ),
        ],
      }))
    : [];
  return {
    width: series.width,
    height: series.height,
    joints: [...TRACK_JOINTS],
    t: series.t.map((v) => Math.round(v * 100) / 100),
    frames,
    reps,
  };
}

/** Index of the last frame at or before `time` (frames are in time order). */
export function frameAt(t: readonly number[], time: number): number {
  let lo = 0;
  let hi = t.length - 1;
  if (hi < 0 || time < t[0]) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (t[mid] <= time) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Where a video of `width`×`height` is drawn inside a box with `contentFit="contain"`. */
export function containRect(box: { width: number; height: number }, width: number, height: number) {
  const scale = Math.min(box.width / width, box.height / height);
  const w = width * scale;
  const h = height * scale;
  return { left: (box.width - w) / 2, top: (box.height - h) / 2, width: w, height: h };
}
