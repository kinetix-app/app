import { isNum, median, nanmean, roundTo } from './numeric';
import type { Prepared } from './prepare';
import type { Rep } from './reps';
import type { Criterion } from './spec';

export const MIN_CONFIDENCE = 0.6; // below this, the criterion is not evaluated for that rep
export const FAULT_BELOW = 0.7; // sub-score below which the rep counts as a fault
export const BREAKDOWN_DROP = 15; // points the score must drop before we talk about fatigue
export const SEVERITY = { invalidates: 3.0, technique: 2.0, detail: 1.0 } as const;

export type CriterionResult = {
  value: number | null;
  sub: number | null;
  conf: number | null;
  deduction?: number | null;
  disabled?: true;
};
export type RepCriteria = Record<string, CriterionResult>;

/** 1 inside the ideal band; falls linearly to 0 at `tolerance` units outside it. */
export function subscore(value: number, c: Criterion): number {
  if (c.ideal_min !== undefined && value < c.ideal_min)
    return Math.max(0, 1 - (c.ideal_min - value) / c.tolerance);
  if (c.ideal_max !== undefined && value > c.ideal_max)
    return Math.max(0, 1 - (value - c.ideal_max) / c.tolerance);
  return 1.0;
}

export function bandDistance(value: number, c: Criterion): number {
  if (c.ideal_min !== undefined && value < c.ideal_min) return c.ideal_min - value;
  if (c.ideal_max !== undefined && value > c.ideal_max) return value - c.ideal_max;
  return 0.0;
}

export function scoreRep(
  metrics: Record<string, number>,
  rep: Rep,
  prep: Prepared,
  criteria: Criterion[],
): { results: RepCriteria; score: number | null; valid: boolean } {
  const results: RepCriteria = {};
  let wsum = 0;
  let acc = 0;
  for (const c of criteria) {
    if (c.disabled) {
      // Kept in the spec for the record, never scored or shown.
      results[c.id] = { value: null, sub: null, conf: null, disabled: true };
      continue;
    }
    const value = metrics[c.metric] ?? Number.NaN;
    const perFrame: number[] = [];
    for (let i = rep.start; i <= rep.end; i++) {
      perFrame.push(Math.min(...c.points.map((p) => prep.vis[p][i])));
    }
    const conf = nanmean(perFrame);
    let sub: number | null = null;
    if (isNum(value) && conf >= MIN_CONFIDENCE) {
      sub = subscore(value, c);
      wsum += c.weight;
      acc += c.weight * sub;
    }
    results[c.id] = { value: isNum(value) ? roundTo(value, 4) : null, sub, conf: roundTo(conf, 2) };
  }
  const score = wsum === 0 ? null : (100 * acc) / wsum;
  for (const c of criteria) {
    const r = results[c.id];
    r.deduction = r.sub === null ? null : (100 * c.weight * (1 - r.sub)) / wsum;
  }
  const valid = criteria.every((c) => c.severity !== 'invalidates' || results[c.id].sub !== 0);
  return { results, score, valid };
}

/** First rep from which all reps drop BREAKDOWN_DROP points or more (after at least two reps). */
export function findBreakdown(scores: number[]): number | null {
  for (let k = 2; k < scores.length - 1; k++) {
    const base = median(scores.slice(0, k));
    if (scores.slice(k).every((s) => s <= base - BREAKDOWN_DROP)) return k;
  }
  return null;
}
