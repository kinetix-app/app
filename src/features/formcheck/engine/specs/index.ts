import { parseSpec, type ExerciseSpec } from '../spec';
import backSquat from './back_squat.json';
import dumbbellRow from './dumbbell_row.json';
import hammerCurl from './hammer_curl.json';
import pushUp from './push_up.json';
import seatedShoulderPress from './seated_shoulder_press.json';

/**
 * Bundled exercise specs, same content as the Python reference (model/specs) so parity
 * holds. They are validated on load: a malformed spec fails fast instead of mis-scoring a set.
 */
const raw = {
  back_squat: backSquat,
  push_up: pushUp,
  hammer_curl: hammerCurl,
  seated_shoulder_press: seatedShoulderPress,
  dumbbell_row: dumbbellRow,
};

export type SpecId = keyof typeof raw;

export const bundledSpecs: Record<SpecId, ExerciseSpec> = {
  back_squat: parseSpec(raw.back_squat),
  push_up: parseSpec(raw.push_up),
  hammer_curl: parseSpec(raw.hammer_curl),
  seated_shoulder_press: parseSpec(raw.seated_shoulder_press),
  dumbbell_row: parseSpec(raw.dumbbell_row),
};
