/**
 * Numeric helpers that reproduce numpy/Python behaviour exactly, so the engine gives the same
 * numbers as the Python reference (model/kinetix_technique.py). NaN means "no data".
 */

export type Series = number[];

export const isNum = (x: number): boolean => !Number.isNaN(x);

export function finite(xs: readonly number[]): number[] {
  return xs.filter(isNum);
}

/** Python's round(): halves go to the even neighbour (round(2.5) == 2). */
export function roundHalfEven(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** Python's round(x, n) for display values; exact ties are rare and only matter for text. */
export function roundTo(x: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
}

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function nanmean(xs: readonly number[]): number {
  return mean(finite(xs));
}

function sortedFinite(xs: readonly number[]): number[] {
  return finite(xs).sort((a, b) => a - b);
}

/** np.median (NaN in → NaN out). */
export function median(xs: readonly number[]): number {
  if (xs.length === 0 || xs.some((x) => !isNum(x))) return NaN;
  return nanmedian(xs);
}

/** np.nanmedian: median of the non-NaN values; NaN if there are none. */
export function nanmedian(xs: readonly number[]): number {
  const s = sortedFinite(xs);
  const n = s.length;
  if (n === 0) return NaN;
  const h = n >> 1;
  return n % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

/** np.nanpercentile with the default linear interpolation. */
export function nanpercentile(xs: readonly number[], q: number): number {
  const s = sortedFinite(xs);
  const n = s.length;
  if (n === 0) return NaN;
  const pos = (q / 100) * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, n - 1);
  const frac = pos - lo;
  // numpy's lerp: a + (b - a) * t, switched to b - (b - a) * (1 - t) for t >= 0.5
  return frac >= 0.5 ? s[hi] - (s[hi] - s[lo]) * (1 - frac) : s[lo] + (s[hi] - s[lo]) * frac;
}

export function nanmax(xs: readonly number[]): number {
  let m = NaN;
  for (const x of xs) if (isNum(x) && !(x <= m)) m = x;
  return m;
}

export function nanmin(xs: readonly number[]): number {
  let m = NaN;
  for (const x of xs) if (isNum(x) && !(x >= m)) m = x;
  return m;
}

/** np.nanargmax: index of the first maximum, ignoring NaN. */
export function nanargmax(xs: readonly number[]): number {
  let best = -1;
  for (let i = 0; i < xs.length; i++) {
    if (isNum(xs[i]) && (best < 0 || xs[i] > xs[best])) best = i;
  }
  return best;
}

export function diff(xs: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < xs.length; i++) out.push(xs[i] - xs[i - 1]);
  return out;
}

/** np.gradient(f, t) with non-uniform spacing (second order inside, first order at the edges). */
export function gradient(f: readonly number[], t: readonly number[]): number[] {
  const n = f.length;
  const out = new Array<number>(n).fill(NaN);
  if (n < 2) return out;
  out[0] = (f[1] - f[0]) / (t[1] - t[0]);
  out[n - 1] = (f[n - 1] - f[n - 2]) / (t[n - 1] - t[n - 2]);
  for (let i = 1; i < n - 1; i++) {
    const hs = t[i] - t[i - 1];
    const hd = t[i + 1] - t[i];
    const a = -hd / (hs * (hd + hs));
    const b = (hd - hs) / (hd * hs);
    const c = hs / (hd * (hd + hs));
    out[i] = a * f[i - 1] + b * f[i] + c * f[i + 1];
  }
  return out;
}

/** np.degrees multiplies by the constant 180/π. */
export const degrees = (rad: number): number => rad * (180 / Math.PI);

/** np.linalg.norm of a 2D/3D vector: sqrt of the plain sum of squares (Math.hypot rounds differently). */
export const norm2 = (dx: number, dy: number): number => Math.sqrt(dx * dx + dy * dy);
export const norm3 = (dx: number, dy: number, dz: number): number =>
  Math.sqrt(dx * dx + dy * dy + dz * dz);

/** Python's `f"{x:.{d}f}"`: rounds the exact binary value, halves to even (JS toFixed rounds them up). */
export function formatFixed(x: number, decimals: number): string {
  if (!Number.isFinite(x)) return String(x);
  const exact = Math.abs(x).toFixed(100); // the exact decimal expansion of the double
  const [whole, frac = ''] = exact.split('.');
  const kept = whole + frac.slice(0, decimals);
  const rest = frac.slice(decimals);
  const first = rest.charCodeAt(0) - 48;
  const tail = rest.slice(1).replace(/0+$/, '');
  let roundUp = first > 5 || (first === 5 && tail.length > 0);
  if (first === 5 && tail.length === 0) roundUp = (kept.charCodeAt(kept.length - 1) - 48) % 2 === 1;
  let digits = kept;
  if (roundUp) {
    const n = BigInt(kept) + 1n;
    digits = n.toString().padStart(kept.length, '0');
  }
  const intLen = digits.length - decimals;
  const intPart = digits.slice(0, intLen).replace(/^0+(?=\d)/, '') || '0';
  const fracPart = decimals > 0 ? '.' + digits.slice(intLen) : '';
  const negative = x < 0 || Object.is(x, -0); // Python keeps the sign: f"{-0.04:.1f}" == "-0.0"
  return (negative ? '-' : '') + intPart + fracPart;
}
