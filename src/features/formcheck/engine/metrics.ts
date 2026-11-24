import {
  diff,
  gradient,
  isNum,
  median,
  nanmax,
  nanmean,
  nanmin,
  roundHalfEven,
  type Series,
} from './numeric';
import type { Rep } from './reps';
import type { Signals } from './signals';
import type { MetricSpec } from './spec';

type Phase = NonNullable<MetricSpec['phase']>;

export function phaseBounds(rep: Rep, phase: Phase, n: number, dt: number): [number, number] {
  switch (phase) {
    case 'rep':
      return [rep.start, rep.end];
    case 'out':
      return [rep.start, rep.extreme];
    case 'out_first_half':
      return [rep.start, rep.start + Math.max(1, Math.floor((rep.extreme - rep.start) / 2))];
    case 'return':
      return [rep.extreme, rep.end];
    case 'return_first_half':
      return [rep.extreme, rep.extreme + Math.max(1, Math.floor((rep.end - rep.extreme) / 2))];
    case 'end_window': {
      const half = roundHalfEven(0.3 / dt);
      return [Math.max(0, rep.end - half), Math.min(n - 1, rep.end + half)];
    }
    case 'extreme':
      return [rep.extreme, rep.extreme];
  }
}

function need(signals: Signals, name: string | undefined): Series {
  const s = name === undefined ? undefined : signals[name];
  if (!s) throw new Error(`Metric refers to unknown signal ${String(name)}`);
  return s;
}

export function metricValue(m: MetricSpec, rep: Rep, signals: Signals, t: Series): number {
  const dt = median(diff(t));
  const [a, b] = phaseBounds(rep, m.phase ?? 'rep', t.length, dt);
  if (m.type === 'duration') return t[b] - t[a];
  if (m.type === 'recovery_time') {
    // Time from the extreme until the signal has come `fraction` of the way back to where the rep ends.
    const sig = need(signals, m.signal);
    const start = sig[rep.end];
    const ext = sig[rep.extreme];
    if (!isNum(start) || !isNum(ext)) return Number.NaN;
    const target = ext + (m.fraction ?? 0.8) * (start - ext);
    const dir = Math.sign(start - ext);
    for (let i = rep.extreme; i <= rep.end; i++) {
      if ((sig[i] - target) * dir >= 0) return t[i] - t[rep.extreme];
    }
    return Number.NaN;
  }
  const sig = need(signals, m.signal);
  const window = (m.type === 'mean_speed' ? gradient(sig, t) : sig).slice(a, b + 1);
  if (window.length === 0 || window.filter((x) => !isNum(x)).length / window.length > 0.3)
    return Number.NaN;
  const agg = m.agg ?? 'mean';
  if (m.type === 'mean_speed' || agg === 'mean') return nanmean(window);
  switch (agg) {
    case 'max':
      return nanmax(window);
    case 'min':
      return nanmin(window);
    case 'range':
      return nanmax(window) - nanmin(window);
    case 'value':
      return window[0];
    case 'rise_from_start':
      return isNum(window[0]) ? nanmax(window) - window[0] : Number.NaN;
  }
}
