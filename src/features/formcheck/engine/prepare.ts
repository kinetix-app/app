import {
  diff,
  isNum,
  mean,
  median,
  nanmedian,
  norm2,
  norm3,
  roundHalfEven,
  type Series,
} from './numeric';
import { JOINTS, type ExerciseSpec, type Joint } from './spec';

/** MediaPipe pose output for one set, one row per frame (33 landmarks; NaN when not detected). */
export type PoseSeries = {
  /** Seconds from the start of the set. */
  t: number[];
  /** Normalized image coordinates (0–1): frames × 33 × [x, y]. */
  xy: number[][][];
  /** frames × 33 */
  visibility: number[][];
  width: number;
  height: number;
  /** pose_world_landmarks in meters: frames × 33 × [x, y, z]. */
  world?: number[][][] | null;
  /** Phone tilt from the accelerometer, degrees. */
  rollDeg?: number;
};

export type Side = 'left' | 'right';
export type Track = { x: Series; y: Series };

export type Prepared = {
  t: Series;
  pts: Record<Joint, Track>;
  vis: Record<Joint, Series>;
  side: Side;
  /** +1 when the person faces +x in the image, −1 otherwise. */
  facing: number;
  sideViewRatio: number;
  /** Median 3D length between two joints, in meters; key `a|b`. */
  worldLen: Map<string, number>;
  warnings: string[];
};

export const LANDMARKS = [
  'nose',
  'left_eye_inner',
  'left_eye',
  'left_eye_outer',
  'right_eye_inner',
  'right_eye',
  'right_eye_outer',
  'left_ear',
  'right_ear',
  'mouth_left',
  'mouth_right',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_pinky',
  'right_pinky',
  'left_index',
  'right_index',
  'left_thumb',
  'right_thumb',
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
export const IDX: Record<string, number> = Object.fromEntries(LANDMARKS.map((n, i) => [n, i]));

export const MIN_VISIBILITY = 0.5;
export const MAX_GAP_S = 0.17;
export const MAX_SIDE_RATIO = 0.35;
const DEFAULT_SIDE_JOINTS: Joint[] = ['shoulder', 'hip', 'knee', 'ankle'];

export function sideJoints(spec?: ExerciseSpec): Joint[] {
  return spec?.side_joints ?? DEFAULT_SIDE_JOINTS;
}

// ---------------------------------------------------------------- cleaning

/** 1€ filter (Casiez, Roussel and Vogel, CHI 2012): little jitter at rest, little lag when moving. */
class OneEuro {
  private x: number | null = null;
  private dx = 0;
  constructor(
    private readonly minCutoff = 1.2,
    private readonly beta = 0.02,
    private readonly dCutoff = 1.0,
  ) {}

  private static alpha(cutoff: number, dt: number) {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  step(x: number, dt: number): number {
    if (this.x === null) {
      this.x = x;
      this.dx = 0;
      return x;
    }
    const dx = (x - this.x) / dt;
    const aD = OneEuro.alpha(this.dCutoff, dt);
    this.dx = aD * dx + (1 - aD) * this.dx;
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    const a = OneEuro.alpha(cutoff, dt);
    this.x = a * x + (1 - a) * this.x;
    return this.x;
  }
}

/** Applies the 1€ filter and restarts it after each gap. */
export function smooth(values: Series, t: Series): Series {
  const out = new Array<number>(values.length).fill(NaN);
  let f: OneEuro | null = null;
  for (let i = 0; i < values.length; i++) {
    if (!isNum(values[i])) {
      f = null;
      continue;
    }
    if (f === null) {
      f = new OneEuro();
      out[i] = f.step(values[i], 1.0);
    } else {
      out[i] = f.step(values[i], Math.max(t[i] - t[i - 1], 1e-3));
    }
  }
  return out;
}

/** Linear interpolation over gaps of at most `maxGap` frames with data on both sides. */
export function fillGaps(x: Series, maxGap: number): Series {
  const out = x.slice();
  const n = x.length;
  let i = 0;
  while (i < n) {
    if (isNum(x[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && !isNum(x[j])) j++;
    if (i > 0 && j < n && j - i <= maxGap) {
      const a = x[i - 1];
      const b = x[j];
      const span = j - (i - 1);
      for (let k = i; k < j; k++) out[k] = a + ((b - a) * (k - (i - 1))) / span;
    }
    i = j;
  }
  return out;
}

/** Hampel filter: discards values more than k deviations away from the local median. */
export function removeSpikes(x: Series, window = 3, k = 3.0, floor = 6.0): Series {
  const out = x.slice();
  const n = x.length;
  for (let i = 0; i < n; i++) {
    const seg = x.slice(Math.max(0, i - window), Math.min(n, i + window + 1)).filter(isNum);
    if (!isNum(x[i]) || seg.length < 3) continue;
    const med = median(seg);
    const mad = 1.4826 * median(seg.map((v) => Math.abs(v - med)));
    if (Math.abs(x[i] - med) > Math.max(k * mad, floor)) out[i] = NaN;
  }
  return out;
}

function lengths(a: Track, b: Track): Series {
  return a.x.map((_, i) => norm2(a.x[i] - b.x[i], a.y[i] - b.y[i]));
}

/** In a side view, segment lengths barely change: if they do, the landmark is doubtful. */
function rejectOutliers(pts: Record<Joint, Track>): number {
  const dev = (a: Joint, b: Joint) => {
    const len = lengths(pts[a], pts[b]);
    const med = nanmedian(len);
    return len.map((l) => {
      const d = Math.abs(l / med - 1);
      return isNum(d) ? d : 0;
    });
  };
  const thigh = dev('hip', 'knee');
  const shin = dev('knee', 'ankle');
  const torso = dev('hip', 'shoulder');
  const flags: [Joint, boolean[]][] = [
    ['knee', thigh.map((v, i) => v > 0.15 && shin[i] > 0.15)],
    ['hip', thigh.map((v, i) => v > 0.15 && torso[i] > 0.15)],
    ['shoulder', torso.map((v, i) => v > 0.25 && thigh[i] < 0.08)],
    ['ankle', shin.map((v, i) => v > 0.25 && thigh[i] < 0.08)],
  ];
  let count = 0;
  for (const [j, mask] of flags) {
    mask.forEach((m, i) => {
      if (m) {
        pts[j].x[i] = NaN;
        pts[j].y[i] = NaN;
        count++;
      }
    });
  }
  return count;
}

export function worldKey(a: Joint, b: Joint): string {
  return `${a}|${b}`;
}

export function prepare(series: PoseSeries, spec?: ExerciseSpec): Prepared {
  const { width, height } = series;
  const T = series.t.length;
  // Pixels, with the phone tilt corrected so that "vertical" is gravity.
  const r = (-(series.rollDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const cx = width / 2;
  const cy = height / 2;
  const px = (f: number, k: number): [number, number] => {
    const x = series.xy[f][k][0] * width;
    const y = series.xy[f][k][1] * height;
    if (!series.rollDeg) return [x, y];
    return [(x - cx) * cos - (y - cy) * sin + cx, (x - cx) * sin + (y - cy) * cos + cy];
  };

  const sideVis = (side: Side) =>
    mean(sideJoints(spec).flatMap((j) => series.visibility.map((v) => v[IDX[`${side}_${j}`]])));
  const side: Side = sideVis('left') >= sideVis('right') ? 'left' : 'right';
  const warnings: string[] = [];

  const shoulders: Series = [];
  const torso: Series = [];
  for (let f = 0; f < T; f++) {
    shoulders.push(Math.abs(px(f, IDX.left_shoulder)[0] - px(f, IDX.right_shoulder)[0]));
    const s = px(f, IDX[`${side}_shoulder`]);
    const h = px(f, IDX[`${side}_hip`]);
    torso.push(norm2(s[0] - h[0], s[1] - h[1]));
  }
  const sideViewRatio = nanmedian(shoulders) / nanmedian(torso);
  if (sideViewRatio > MAX_SIDE_RATIO) warnings.push('The camera does not look like a side view.');

  const dt = median(diff(series.t));
  const maxGap = Math.max(1, roundHalfEven(MAX_GAP_S / dt));
  let thighPx = nanmedian(
    series.t.map((_, f) => {
      const a = px(f, IDX[`${side}_hip`]);
      const b = px(f, IDX[`${side}_knee`]);
      return norm2(a[0] - b[0], a[1] - b[1]);
    }),
  );
  // Legs out of frame (e.g. an upper-body shot of a curl): the torso is similar in size.
  if (!isNum(thighPx)) thighPx = 0.9 * nanmedian(torso);

  const pts = {} as Record<Joint, Track>;
  const vis = {} as Record<Joint, Series>;
  let spikes = 0;
  for (const j of JOINTS) {
    const k = IDX[`${side}_${j}`];
    const v = series.visibility.map((row) => row[k]);
    const track: Track = { x: [], y: [] };
    for (let f = 0; f < T; f++) {
      const [x, y] = px(f, k);
      const hidden = v[f] < MIN_VISIBILITY;
      track.x.push(hidden ? NaN : x);
      track.y.push(hidden ? NaN : y);
    }
    for (const axis of ['x', 'y'] as const) {
      const before = track[axis].filter((n) => !isNum(n)).length;
      track[axis] = removeSpikes(track[axis], 3, 3.0, 0.05 * thighPx);
      spikes += track[axis].filter((n) => !isNum(n)).length - before;
    }
    pts[j] = track;
    vis[j] = v;
  }

  const rejected = rejectOutliers(pts);
  if (spikes || rejected) {
    warnings.push(
      `Discarded ${spikes} spikes and ${rejected} landmarks inconsistent with segment lengths.`,
    );
  }

  for (const j of JOINTS) {
    for (const axis of ['x', 'y'] as const) {
      pts[j][axis] = smooth(fillGaps(pts[j][axis], maxGap), series.t);
    }
  }

  let toe = nanmedian(pts.foot_index.x.map((x, i) => x - pts.heel.x[i]));
  if (!isNum(toe)) {
    // Feet out of frame: the nose points where the person faces.
    toe = nanmedian(
      series.t.map((_, f) =>
        series.visibility[f][IDX.nose] < MIN_VISIBILITY ? NaN : px(f, IDX.nose)[0] - pts.ear.x[f],
      ),
    );
  }
  const facing = !isNum(toe) || toe >= 0 ? 1.0 : -1.0;

  const worldLen = new Map<string, number>();
  if (series.world) {
    const world = series.world;
    JOINTS.forEach((a, i) => {
      for (const b of JOINTS.slice(i + 1)) {
        const ka = IDX[`${side}_${a}`];
        const kb = IDX[`${side}_${b}`];
        const d = nanmedian(
          world.map((w) => norm3(w[ka][0] - w[kb][0], w[ka][1] - w[kb][1], w[ka][2] - w[kb][2])),
        );
        worldLen.set(worldKey(a, b), d);
        worldLen.set(worldKey(b, a), d);
      }
    });
  }

  return { t: series.t, pts, vis, side, facing, sideViewRatio, worldLen, warnings };
}
