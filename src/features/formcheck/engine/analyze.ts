import {
  buildFeedback,
  faultStats,
  liveCues,
  llmPayload,
  type Feedback,
  type LiveCue,
  type Stats,
} from './feedback';
import { metricValue } from './metrics';
import { isNum, nanmax, nanmedian, nanpercentile, roundTo, type Series } from './numeric';
import { MAX_SIDE_RATIO, prepare, type PoseSeries, type Prepared, type Side } from './prepare';
import { detectReps } from './reps';
import { findBreakdown, scoreRep, type RepCriteria } from './scoring';
import { computeSignals } from './signals';
import type { ExerciseSpec, Joint, Locale } from './spec';

/** Same version as the Python reference this port matches (model/kinetix_technique.py). */
export const ENGINE_VERSION = '0.2.0';
const MIN_COVERAGE = 0.6; // fraction of frames in which every required joint must be visible
const MIN_SET_SECONDS = 1.0;

export type UnassessableReason =
  'too_short' | 'not_side_view' | 'missing_joints' | 'low_confidence' | 'no_reps';

export type Unassessable = {
  exercise: string;
  assessable: false;
  reason: UnassessableReason;
  error: string;
  detail: { side_view_ratio?: number; joints?: Joint[]; reps?: number };
  warnings: string[];
};

export type RepReport = {
  rep: number;
  start_s: number;
  bottom_s: number;
  end_s: number;
  rom: number;
  metrics: Record<string, number>;
  criteria: RepCriteria;
  score: number | null;
  valid: boolean;
};

export type Assessed = {
  exercise: string;
  spec_version: number;
  engine_version: string;
  assessable: true;
  side: Side;
  side_view_ratio: number;
  warnings: string[];
  rest_value: number;
  reps: RepReport[];
  stats: Stats;
  breakdown_rep: number | null;
  velocity_loss_last_rep: number | null;
  feedback: Feedback;
  live_cues: LiveCue[];
  llm_payload: ReturnType<typeof llmPayload>;
  /** The rep signal, for plots and debugging. */
  rep_signal: Series;
};

export type EngineResult = Assessed | Unassessable;

const UNASSESSABLE: Record<UnassessableReason, Record<Locale, string>> = {
  // Kinetix-061: say why there is no assessment, and only the guidance that fixes it.
  too_short: {
    es: 'La grabación es demasiado corta para analizar una serie.',
    en: 'The recording is too short to analyze a set.',
  },
  not_side_view: {
    es: 'La cámara no está de lado. Gírala para que te vea de perfil, con el lado que trabaja hacia el móvil.',
    en: 'The camera is not side-on. Turn it so it sees you in profile, working side toward the phone.',
  },
  missing_joints: {
    es: 'Fuera de plano o poco visible: {joints}. Aleja o sube el móvil hasta que entre en el encuadre.',
    en: 'Out of frame or unclear: {joints}. Move the phone back or up until it fits in the frame.',
  },
  low_confidence: {
    es: 'Se ven las repeticiones, pero no lo bastante bien para puntuarlas. Busca más luz y un fondo despejado.',
    en: 'The reps are visible, but not clearly enough to score them. Find more light and a clearer background.',
  },
  no_reps: {
    es: 'No se ha detectado ninguna repetición completa de {exercise}.',
    en: 'No complete {exercise} rep was detected.',
  },
};

const JOINT_NAMES: Record<Locale, Record<Joint, string>> = {
  es: {
    ear: 'la cabeza',
    shoulder: 'el hombro',
    elbow: 'el codo',
    wrist: 'la muñeca',
    hip: 'la cadera',
    knee: 'la rodilla',
    ankle: 'el tobillo',
    heel: 'el talón',
    foot_index: 'la punta del pie',
  },
  en: {
    ear: 'head',
    shoulder: 'shoulder',
    elbow: 'elbow',
    wrist: 'wrist',
    hip: 'hip',
    knee: 'knee',
    ankle: 'ankle',
    heel: 'heel',
    foot_index: 'toes',
  },
};

/** Joints without which the set cannot be assessed: the rep signal's, unless the spec says otherwise. */
export function requiredJoints(spec: ExerciseSpec): Joint[] {
  if (spec.required) return [...spec.required];
  const s = spec.signals[spec.rep.signal];
  const joints = [...(s.points ?? (s.point ? [s.point] : [])), ...(s.scale ?? [])];
  return [...new Set(joints)];
}

function unassessable(
  reason: UnassessableReason,
  spec: ExerciseSpec,
  locale: Locale,
  warnings: string[] = [],
  detail: Unassessable['detail'] = {},
): Unassessable {
  const vars: Record<string, string> = { exercise: spec.name[locale].toLowerCase() };
  if (detail.joints) {
    vars.joints = detail.joints
      .map((j) => JOINT_NAMES[locale][j])
      .join(locale === 'es' ? ' y ' : ' and ');
  }
  const error = UNASSESSABLE[reason][locale].replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
  return { exercise: spec.id, assessable: false, reason, error, detail, warnings: [...warnings] };
}

function checkInput(
  series: PoseSeries,
  spec: ExerciseSpec,
  prep: Prepared,
  locale: Locale,
): Unassessable | null {
  const t = series.t;
  if (t.length < 2 || t[t.length - 1] - t[0] < MIN_SET_SECONDS)
    return unassessable('too_short', spec, locale);
  if ((spec.view ?? 'side') === 'side' && !(prep.sideViewRatio <= MAX_SIDE_RATIO)) {
    return unassessable('not_side_view', spec, locale, prep.warnings, {
      side_view_ratio: roundTo(prep.sideViewRatio, 2),
    });
  }
  const required = requiredJoints(spec);
  const coverage = (j: Joint) => prep.pts[j].x.filter(isNum).length / t.length;
  const missing = required.filter((j) => coverage(j) < MIN_COVERAGE);
  const together =
    t.filter((_, i) => required.every((j) => isNum(prep.pts[j].x[i]))).length / t.length;
  if (missing.length || together < MIN_COVERAGE) {
    // Each joint alone may be seen often enough while all of them together rarely are.
    const worst = missing.length
      ? missing
      : [required.slice(1).reduce((a, j) => (coverage(j) < coverage(a) ? j : a), required[0])];
    return unassessable('missing_joints', spec, locale, prep.warnings, { joints: worst });
  }
  return null;
}

/** Turns the landmarks of one set into reps, a score per rep, a set score and one tip. */
export function analyze(
  series: PoseSeries,
  spec: ExerciseSpec,
  locale: Locale = 'en',
): EngineResult {
  const prep = prepare(series, spec);
  const problem = checkInput(series, spec, prep, locale);
  if (problem) return problem;
  const signals = computeSignals(spec, prep);
  const repSignal = signals[spec.rep.signal];
  const { reps, rest } = detectReps(repSignal, prep.t, spec.rep);
  if (!reps.length) return unassessable('no_reps', spec, locale, prep.warnings);

  const inside = new Array<boolean>(prep.t.length).fill(false);
  for (const r of reps) for (let i = r.start; i <= r.end; i++) inside[i] = true;
  for (const [name, s] of Object.entries(spec.signals)) {
    if (s.baseline !== 'rest') continue;
    const outside = signals[name].filter((_, i) => !inside[i]);
    // No rest frames (reps back to back): use the calmest values instead.
    const base = outside.some(isNum) ? nanmedian(outside) : nanpercentile(signals[name], 5);
    signals[name] = signals[name].map((v) => v - base);
  }

  const repMetrics = reps.map((r) =>
    Object.fromEntries(
      Object.entries(spec.metrics).map(([k, m]) => [k, metricValue(m, r, signals, prep.t)]),
    ),
  );
  const repResults: RepCriteria[] = [];
  const scores: (number | null)[] = [];
  const valid: boolean[] = [];
  reps.forEach((r, i) => {
    const out = scoreRep(repMetrics[i], r, prep, spec.criteria);
    repResults.push(out.results);
    scores.push(out.score);
    valid.push(out.valid);
  });

  if (scores.every((s) => s === null)) {
    return unassessable('low_confidence', spec, locale, prep.warnings, { reps: reps.length });
  }
  const breakdown = findBreakdown(scores.filter((s): s is number => s !== null));
  let velocityLoss: number | null = null;
  if (spec.effort_metric) {
    const speeds = repMetrics.map((m) => m[spec.effort_metric as string]);
    const first = speeds.slice(0, 2);
    const top = first.some(isNum) ? nanmax(first) : NaN;
    const last = speeds[speeds.length - 1];
    velocityLoss = top > 0 && isNum(last) ? 1 - last / top : null;
  }

  const stats = faultStats(repResults, spec.criteria, prep);
  const feedback = buildFeedback(
    spec,
    repResults,
    scores,
    valid,
    stats,
    breakdown,
    velocityLoss,
    locale,
  );
  return {
    exercise: spec.id,
    spec_version: spec.version,
    engine_version: ENGINE_VERSION,
    assessable: true,
    side: prep.side,
    side_view_ratio: roundTo(prep.sideViewRatio, 2),
    warnings: prep.warnings,
    rest_value: roundTo(rest, 1),
    reps: reps.map((r, i) => ({
      rep: i + 1,
      start_s: roundTo(prep.t[r.start], 2),
      bottom_s: roundTo(prep.t[r.extreme], 2),
      end_s: roundTo(prep.t[r.end], 2),
      rom: roundTo(r.rom, 1),
      metrics: repMetrics[i],
      criteria: repResults[i],
      score: scores[i] === null ? null : roundTo(scores[i] as number, 1),
      valid: valid[i],
    })),
    stats,
    breakdown_rep: breakdown,
    velocity_loss_last_rep: velocityLoss,
    feedback,
    live_cues: liveCues(repResults, spec.criteria, spec.cues, locale),
    llm_payload: llmPayload(spec, feedback, stats, velocityLoss, locale),
    rep_signal: signals[spec.rep.signal],
  };
}
