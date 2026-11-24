import {
  diff,
  isNum,
  median,
  nanmax,
  nanmedian,
  nanpercentile,
  roundHalfEven,
  type Series,
} from './numeric';
import type { RepConfig } from './spec';

export type Rep = { start: number; extreme: number; end: number; rom: number };

const REP_FILTER_S = 0.3; // median filter on the rep signal: removes one-off spikes, keeps the turns
const REP_PROMINENCE = 0.35; // a rep must move at least this fraction of the set's typical range…
const REP_EDGE = 0.1; // …and starts/ends within this fraction of the range from its rest peaks
const REP_MIN_COVERAGE = 0.8; // fraction of a rep's frames that must have the rep signal

/** Median over a centered window of k frames (k odd), ignoring NaN. */
export function medianFilter(x: Series, k: number): Series {
  const h = Math.floor(k / 2);
  return x.map((_, i) => nanmedian(x.slice(Math.max(0, i - h), i + h + 1)));
}

/**
 * Local minima that rise at least `minProm` on both sides before reaching a lower point
 * (topographic prominence). A gap (NaN) ends the climb on that side.
 */
export function prominentValleys(y: Series, minProm: number): number[] {
  const n = y.length;
  const found: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (!isNum(y[i]) || !isNum(y[i - 1]) || !isNum(y[i + 1])) continue;
    if (!(y[i] <= y[i - 1] && y[i] < y[i + 1])) continue;
    const sides: number[] = [];
    for (const step of [-1, 1]) {
      let top = y[i];
      let j = i + step;
      while (j >= 0 && j < n && isNum(y[j]) && y[j] >= y[i]) {
        top = Math.max(top, y[j]);
        j += step;
      }
      sides.push(top);
    }
    if (Math.min(sides[0], sides[1]) - y[i] >= minProm) found.push(i);
  }
  return found;
}

function firstNanIndex(y: Series, from: number, to: number): number {
  for (let i = from; i < to; i++) if (!isNum(y[i])) return i;
  return -1;
}

function lastNanIndex(y: Series, from: number, to: number): number {
  for (let i = to - 1; i >= from; i--) if (!isNum(y[i])) return i;
  return -1;
}

function argmaxIn(y: Series, from: number, to: number): number {
  let best = -1;
  for (let i = from; i <= to; i++) if (isNum(y[i]) && (best < 0 || y[i] > y[best])) best = i;
  return best;
}

/**
 * Finds reps in a whole set (the analysis runs after the set, so it can look both ways).
 * The signal is median-filtered and flipped so a rep is always a valley; each rep is a valley
 * prominent enough relative to this person's own range. Returns the reps and the rest value.
 */
export function detectReps(
  signal: Series,
  t: Series,
  cfg: RepConfig,
): { reps: Rep[]; rest: number } {
  const sign = cfg.rest === 'high' ? 1.0 : -1.0;
  const dt = t.length > 1 ? median(diff(t)) : 1 / 30;
  const k = Math.max(3, roundHalfEven(REP_FILTER_S / dt) | 1);
  const y = medianFilter(signal, k).map((v) => sign * v);
  if (!y.some(isNum)) return { reps: [], rest: Number.NaN };
  const span = nanpercentile(y, 95) - nanpercentile(y, 5);
  const minProm = Math.max(cfg.min_rom, REP_PROMINENCE * span);
  const valleys = prominentValleys(y, minProm);

  // Two valleys with no real rise between them are one rep (a wobble at the bottom): keep the deeper.
  const merged: number[] = [];
  for (const v of valleys) {
    const last = merged.at(-1)!;
    if (merged.length && nanmax(y.slice(last, v + 1)) - Math.max(y[last], y[v]) < minProm) {
      if (y[v] < y[last]) merged[merged.length - 1] = v;
      continue;
    }
    merged.push(v);
  }

  const reps: Rep[] = [];
  const peaks: number[] = [];
  merged.forEach((v, idx) => {
    // Search the peaks on each side only within the data connected to this valley.
    let lo = idx > 0 ? merged[idx - 1] : 0;
    const gapLeft = lastNanIndex(y, lo, v);
    if (gapLeft >= 0) lo = gapLeft + 1;
    let hi = idx + 1 < merged.length ? merged[idx + 1] : y.length - 1;
    const gapRight = firstNanIndex(y, v, hi + 1);
    if (gapRight >= 0) hi = gapRight - 1;
    const leftPeak = argmaxIn(y, lo, v);
    const rightPeak = argmaxIn(y, v, hi);
    const rom = Math.min(y[leftPeak], y[rightPeak]) - y[v];
    const edge = REP_EDGE * rom;
    let s = v;
    while (s > leftPeak && (!isNum(y[s - 1]) || y[s - 1] < y[leftPeak] - edge)) s--;
    let e = v;
    while (e < rightPeak && (!isNum(y[e + 1]) || y[e + 1] < y[rightPeak] - edge)) e++;
    s = Math.max(s - 1, leftPeak);
    e = Math.min(e + 1, rightPeak);
    const window = y.slice(s, e + 1);
    const covered = window.filter(isNum).length / window.length;
    const duration = t[e] - t[s];
    if (
      rom >= cfg.min_rom &&
      covered >= REP_MIN_COVERAGE &&
      cfg.min_duration <= duration &&
      duration <= cfg.max_duration
    ) {
      reps.push({ start: s, extreme: v, end: e, rom });
      peaks.push(y[leftPeak], y[rightPeak]);
    }
  });
  const rest = sign * (peaks.length ? median(peaks) : nanpercentile(y, 95));
  return { reps, rest };
}
