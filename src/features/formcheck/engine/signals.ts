import { degrees, nanmedian, norm2, type Series } from './numeric';
import type { Prepared, Track } from './prepare';
import type { ExerciseSpec, Joint } from './spec';

export type Signals = Record<string, Series>;

export function angleDeg(a: Track, b: Track, c: Track): Series {
  return a.x.map((_, i) => {
    const v1x = a.x[i] - b.x[i];
    const v1y = a.y[i] - b.y[i];
    const v2x = c.x[i] - b.x[i];
    const v2y = c.y[i] - b.y[i];
    const cos = (v1x * v2x + v1y * v2y) / (norm2(v1x, v1y) * norm2(v2x, v2y));
    return degrees(Math.acos(Math.min(1, Math.max(-1, cos))));
  });
}

/** Angle of segment a→b from vertical; positive when leaning toward where the person faces. */
export function inclinationDeg(a: Track, b: Track, facing: number): Series {
  return a.x.map((_, i) => degrees(Math.atan2(facing * (b.x[i] - a.x[i]), -(b.y[i] - a.y[i]))));
}

export function segmentScale(prep: Prepared, a: Joint, b: Joint): number {
  const pa = prep.pts[a];
  const pb = prep.pts[b];
  return nanmedian(pa.x.map((_, i) => norm2(pa.x[i] - pb.x[i], pa.y[i] - pb.y[i])));
}

function need<T>(x: T | undefined, what: string): T {
  if (x === undefined) throw new Error(`Spec signal is missing ${what}`);
  return x;
}

export function computeSignals(spec: Pick<ExerciseSpec, 'signals'>, prep: Prepared): Signals {
  const out: Signals = {};
  for (const [name, s] of Object.entries(spec.signals)) {
    const p = (s.points ?? []).map((j) => prep.pts[j]);
    const scale = () => {
      const [a, b] = need(s.scale, 'scale');
      return segmentScale(prep, a, b);
    };
    switch (s.type) {
      case 'angle':
        out[name] = angleDeg(p[0], p[1], p[2]);
        break;
      case 'inclination':
        out[name] = inclinationDeg(p[0], p[1], prep.facing);
        break;
      case 'relative_height': {
        const k = scale();
        out[name] = p[0].y.map((y, i) => (y - p[1].y[i]) / k); // >0: a is below b
        break;
      }
      case 'height': {
        const k = scale();
        out[name] = prep.pts[need(s.point, 'point')].y.map((y) => -y / k);
        break;
      }
      case 'forward_offset': {
        const k = scale();
        out[name] = p[0].x.map((x, i) => (prep.facing * (x - p[1].x[i])) / k); // >0: a is in front of b
        break;
      }
      case 'line_offset': {
        const [q, a, b] = p;
        out[name] = q.x.map((_, i) => {
          const abx = b.x[i] - a.x[i];
          const aby = b.y[i] - a.y[i];
          const cross = abx * (q.y[i] - a.y[i]) - aby * (q.x[i] - a.x[i]);
          const n = norm2(abx, aby);
          return (-prep.facing * cross) / (n * n); // >0: q falls below the line
        });
        break;
      }
    }
  }
  return out;
}
