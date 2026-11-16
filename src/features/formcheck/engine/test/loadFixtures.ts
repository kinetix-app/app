/** Parity fixtures exported by the Python reference (model/export_fixtures.py). */
import { readFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';

import type { PoseSeries } from '../prepare';
import type { Locale } from '../spec';

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type Fixture = {
  name: string;
  locale: Locale;
  spec: unknown;
  series: {
    t: number[];
    width: number;
    height: number;
    roll_deg: number;
    landmarks: number[];
    xy: (number | null)[][][];
    visibility: number[][];
    world: (number | null)[][][] | null;
  };
  expected: { [k: string]: Json };
};

const dir = join(__dirname, 'fixtures');
export const names: string[] = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));

export function load(name: string): Fixture {
  return JSON.parse(gunzipSync(readFileSync(join(dir, `${name}.json.gz`))).toString('utf8'));
}

const num = (v: number | null) => (v === null ? NaN : v);

/** Back to 33 landmarks per frame; the ones the engine does not read are invisible. */
export function toSeries(s: Fixture['series']): PoseSeries {
  const frames = s.t.length;
  const xy = Array.from({ length: frames }, () => Array.from({ length: 33 }, () => [NaN, NaN]));
  const visibility = Array.from({ length: frames }, () => new Array<number>(33).fill(0));
  const world = s.world
    ? Array.from({ length: frames }, () => Array.from({ length: 33 }, () => [NaN, NaN, NaN]))
    : null;
  for (let f = 0; f < frames; f++) {
    s.landmarks.forEach((k, c) => {
      xy[f][k] = s.xy[f][c].map(num);
      visibility[f][k] = s.visibility[f][c];
      if (world && s.world) world[f][k] = s.world[f][c].map(num);
    });
  }
  return { t: s.t, xy, visibility, width: s.width, height: s.height, world, rollDeg: s.roll_deg };
}
