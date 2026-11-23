/**
 * Parity with the Python reference engine (model/kinetix_technique.py).
 *
 * Each fixture holds a set's landmarks, the spec and what Python returned for them. Regenerate with
 * `python export_fixtures.py --out <this folder>/fixtures` in the model repository.
 */
import { analyze } from '../analyze';
import { parseSpec } from '../spec';
import { bundledSpecs } from '../specs';
import { load, names, toSeries, type Json } from './loadFixtures';

// Fields Python rounds before returning: a value on the rounding edge may differ by one unit.
const ROUNDED: Record<string, number> = {
  value: 1e-4,
  conf: 1e-2,
  score: 0.1,
  rom: 0.1,
  start_s: 1e-2,
  bottom_s: 1e-2,
  end_s: 1e-2,
  side_view_ratio: 1e-2,
  rest_value: 0.1,
  frequency: 1e-2,
  priority: 1e-3,
  velocity_loss_last_rep: 1e-2,
};

function close(a: number, b: number, key: string): boolean {
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  const tol = Math.max(ROUNDED[key] ?? 0, 1e-6 * Math.max(1, Math.abs(b)));
  return Math.abs(a - b) <= tol + 1e-12;
}

/** Returns the first difference between the TypeScript result and the Python one, or null. */
function firstDiff(actual: unknown, expected: Json, path: string, key = ''): string | null {
  if (expected === null || typeof expected === 'number') {
    const a = actual === null || actual === undefined ? NaN : actual;
    const e = expected === null ? NaN : expected;
    if (typeof a !== 'number')
      return `${path}: expected ${String(expected)}, got ${JSON.stringify(actual)}`;
    return close(a, e, key) ? null : `${path}: expected ${e}, got ${a}`;
  }
  if (typeof expected === 'string' || typeof expected === 'boolean') {
    return actual === expected
      ? null
      : `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return `${path}: expected an array`;
    if (actual.length !== expected.length)
      return `${path}: expected ${expected.length} items, got ${actual.length}`;
    for (let i = 0; i < expected.length; i++) {
      const d = firstDiff(actual[i], expected[i], `${path}[${i}]`, key);
      if (d) return d;
    }
    return null;
  }
  if (typeof actual !== 'object' || actual === null) return `${path}: expected an object`;
  const obj = actual as Record<string, unknown>;
  for (const [k, v] of Object.entries(expected)) {
    const d = firstDiff(obj[k], v, `${path}.${k}`, k);
    if (d) return d;
  }
  const extra = Object.keys(obj).filter((k) => !(k in expected) && obj[k] !== undefined);
  return extra.length ? `${path}: unexpected keys ${extra.join(', ')}` : null;
}

describe('engine parity with the Python reference', () => {
  it.each(names)('%s', (name) => {
    const fx = load(name);
    const result = analyze(toSeries(fx.series), parseSpec(fx.spec), fx.locale);
    expect(firstDiff(result, fx.expected, name)).toBeNull();
  });
});

describe('bundled specs', () => {
  it('match the specs the fixtures were made with', () => {
    for (const name of names) {
      const fx = load(name);
      const spec = parseSpec(fx.spec);
      const bundled = bundledSpecs[spec.id as keyof typeof bundledSpecs];
      // Synthetic fixtures may use the hand-written bands; everything else must be identical.
      expect({ ...bundled, criteria: [] }).toEqual({ ...spec, criteria: [] });
    }
  });
});

describe('the parity check itself', () => {
  it('notices a changed text, number or missing rep', () => {
    const fx = load('real-squat-good-subject_010');
    const result = analyze(toSeries(fx.series), parseSpec(fx.spec), fx.locale);
    if (!result.assessable) throw new Error('fixture should be assessable');
    expect(
      firstDiff({ ...result, feedback: { ...result.feedback, good: 'x' } }, fx.expected, 'r'),
    ).toMatch(/good/);
    expect(firstDiff({ ...result, rest_value: result.rest_value + 1 }, fx.expected, 'r')).toMatch(
      /rest_value/,
    );
    expect(firstDiff({ ...result, reps: result.reps.slice(1) }, fx.expected, 'r')).toMatch(/reps/);
  });
});
