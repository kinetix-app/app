import { formatFixed, isNum, mean, roundHalfEven, roundTo } from './numeric';
import { worldKey, type Prepared } from './prepare';
import { bandDistance, FAULT_BELOW, SEVERITY, type RepCriteria } from './scoring';
import type { Criterion, ExerciseSpec, Locale } from './spec';

export type CriterionStats = {
  evaluated: number;
  affected_reps: number[];
  frequency: number;
  priority: number;
  value: number | null;
  distance: number | null;
};
export type Stats = Record<string, CriterionStats>;

export type Feedback = {
  headline: string;
  score: number;
  reps: number;
  valid_reps: number;
  partial_reps: number[];
  good: string;
  main_fault: string | null;
  finding: string | null;
  fatigue: string | null;
  next_set: string;
  cue: string | null;
  rep_strip: ('ok' | 'warn' | 'partial')[];
};

export type LiveCue =
  | { rep: number; type: 'reinforcement'; text: string }
  | { rep: number; type: 'cue'; criterion: string; text: string };

/** Python's `f"{x:.{d}f}"`, with a decimal comma in Spanish. */
export function fmt(x: number, decimals = 0, locale: Locale = 'en'): string {
  const text = isNum(x) ? formatFixed(x, decimals) : 'nan';
  return locale === 'es' ? text.replace('.', ',') : text;
}

/** Fills `{name}` placeholders, like Python's str.format with keywords. */
function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Converts a metric to the unit the user understands (cm, °, s). */
export function toUnits(x: number, c: Criterion, prep: Prepared): [number, string] {
  if (c.unit === 'scale') {
    const length = c.scale ? prep.worldLen.get(worldKey(c.scale[0], c.scale[1])) : undefined;
    // As in Python, a missing or zero length falls back to a percentage; NaN does not.
    return length !== undefined && length !== 0
      ? [x * length * 100, 'cm']
      : [x * 100, '% of segment'];
  }
  return [x, c.unit === 'deg' ? '°' : 's'];
}

export function faultStats(
  repResults: RepCriteria[],
  criteria: Criterion[],
  prep: Prepared,
): Stats {
  const stats: Stats = {};
  for (const c of criteria) {
    const evaluated = repResults
      .map((r, i) => [i, r[c.id]] as const)
      .filter(([, r]) => r.sub !== null);
    const affected = evaluated.filter(([, r]) => (r.sub as number) < FAULT_BELOW);
    const freq = evaluated.length ? affected.length / evaluated.length : 0.0;
    const magnitude = affected.length ? mean(affected.map(([, r]) => 1 - (r.sub as number))) : 0.0;
    const values = affected.map(([, r]) => r.value as number);
    const meanValue = affected.length ? mean(values) : null;
    const meanDist = affected.length ? mean(values.map((v) => bandDistance(v, c))) : null;
    stats[c.id] = {
      evaluated: evaluated.length,
      affected_reps: affected.map(([i]) => i + 1),
      frequency: roundTo(freq, 2),
      priority: roundTo(SEVERITY[c.severity] * freq * magnitude, 3),
      value: meanValue === null ? null : toUnits(meanValue, c, prep)[0],
      distance: meanDist === null ? null : toUnits(meanDist, c, prep)[0],
    };
  }
  return stats;
}

const MESSAGES = {
  es: {
    solid: 'Sólida',
    good: 'Buena',
    weak: 'Mejorable',
    until: ', hasta la repetición {k}',
    watch: ' · ojo con {label}',
    early_good: 'Las {k} primeras repeticiones fueron sólidas (nota media {score}).',
    best_rep: 'Tu mejor repetición fue la {rep}.',
    held: 'La técnica aguantó {k} repeticiones; desde la {next}, {what}.',
    and: ' y ',
    quality_drop: 'bajó la calidad',
    slower: ' La última repetición subió un ~{pct} % más despacio que la primera.',
    stop_or_lighten:
      'Con este peso, para en {k} repeticiones, o baja un 5–10 % la carga si quieres completar {total}.',
    focus: 'En la próxima serie piensa solo en esto: {cue}',
    progress:
      'Técnica sólida en toda la serie. Si la última repetición aún iba rápida, prueba a subir la carga.',
    reinforce: '¡Eso es!',
  },
  en: {
    solid: 'Solid',
    good: 'Good',
    weak: 'Needs work',
    until: ', up to rep {k}',
    watch: ' · watch {label}',
    early_good: 'Your first {k} reps were solid (average {score}).',
    best_rep: 'Your best rep was rep {rep}.',
    held: 'Your form held for {k} reps; from rep {next}, {what}.',
    and: ' and ',
    quality_drop: 'quality dropped',
    slower: ' Your last rep came up ~{pct}% slower than your first.',
    stop_or_lighten:
      'At this weight, stop at {k} reps, or drop the load 5–10% to complete {total}.',
    focus: 'Next set, think only about this: {cue}',
    progress: 'Solid form all set. If your last rep still moved fast, try adding weight.',
    reinforce: "That's it!",
  },
} as const;

/** Python's max() over (number, string) tuples: the highest number, ties to the highest id. */
function maxByThenId<T extends string>(items: [number, T][]): T {
  return items
    .slice(1)
    .reduce(
      (best, it) => (it[0] > best[0] || (it[0] === best[0] && it[1] > best[1]) ? it : best),
      items[0],
    )[1];
}

/** Simulates the cues during the set: at most one per rep, only if the fault repeats. */
export function liveCues(
  repResults: RepCriteria[],
  criteria: Criterion[],
  cues: ExerciseSpec['cues'],
  locale: Locale,
): LiveCue[] {
  const sev = Object.fromEntries(criteria.map((c) => [c.id, SEVERITY[c.severity]]));
  const said: Record<string, number> = {};
  const lastSaid: Record<string, number> = {};
  const timeline: LiveCue[] = [];
  let pending: string | null = null;
  repResults.forEach((r, i) => {
    const pend = pending === null ? null : r[pending];
    if (pend && pend.sub !== null && pend.sub >= 0.9) {
      timeline.push({ rep: i + 1, type: 'reinforcement', text: MESSAGES[locale].reinforce });
      pending = null;
      return;
    }
    const window = repResults.slice(Math.max(0, i - 2), i + 1);
    const options: [number, string][] = [];
    for (const cid of Object.keys(sev)) {
      const hits = window.filter(
        (w) => w[cid].sub !== null && (w[cid].sub as number) < FAULT_BELOW,
      ).length;
      const recent = i - (lastSaid[cid] ?? -10) <= 2;
      if (hits >= 2 && !recent && (said[cid] ?? 0) < 2 && r[cid].sub !== null) {
        options.push([sev[cid] * (1 - (r[cid].sub as number)), cid]);
      }
    }
    if (options.length) {
      const cid = maxByThenId(options);
      timeline.push({ rep: i + 1, type: 'cue', criterion: cid, text: cues[cid].live[locale] });
      said[cid] = (said[cid] ?? 0) + 1;
      lastSaid[cid] = i;
      pending = cid;
    }
  });
  return timeline;
}

export function buildFeedback(
  spec: ExerciseSpec,
  repResults: RepCriteria[],
  scores: (number | null)[],
  valid: boolean[],
  stats: Stats,
  breakdown: number | null,
  velocityLoss: number | null,
  locale: Locale = 'en',
): Feedback {
  const { cues, criteria } = spec;
  const msg = MESSAGES[locale];
  const byId = Object.fromEntries(criteria.map((c) => [c.id, c]));
  const total = repResults.length;
  const scored = scores.filter((s): s is number => s !== null);
  const setScore = roundHalfEven(mean(scored));

  const candidates = Object.entries(stats)
    .filter(([, s]) => s.affected_reps.length >= 2)
    .map(([cid, s]) => [s.priority, cid] as [number, string]);
  const main = candidates.length ? maxByThenId(candidates) : null;

  // "Solid" requires a high score and no important fault repeating in one of every four reps.
  const repeated = Object.entries(stats).filter(
    ([cid, s]) =>
      byId[cid].severity !== 'detail' && s.frequency >= 0.25 && s.affected_reps.length >= 2,
  );
  let label: string =
    setScore >= 85 && !repeated.length ? msg.solid : setScore >= 70 ? msg.good : msg.weak;
  if (breakdown !== null) label += fill(msg.until, { k: breakdown });
  else if (main) label += fill(msg.watch, { label: cues[main].label[locale] });

  const clean = criteria.filter(
    (c) => stats[c.id].evaluated >= total / 2 && !stats[c.id].affected_reps.length,
  );
  let good: string;
  if (breakdown !== null && breakdown >= 2) {
    const early = mean(scores.slice(0, breakdown).filter((s): s is number => s !== null));
    good = fill(msg.early_good, { k: breakdown, score: fmt(early, 0, locale) });
  } else if (clean.length) {
    const best = clean.reduce((a, c) => (c.weight > a.weight ? c : a));
    good = cues[best.id].good[locale];
  } else {
    const ranked = scores.map((s) => (s === null ? -1 : s));
    good = fill(msg.best_rep, { rep: ranked.indexOf(Math.max(...ranked)) + 1 });
  }

  const findingFor = (cid: string) => {
    const s = stats[cid];
    const c = byId[cid];
    const decimals = c.unit === 's' ? 1 : 0;
    const distance = s.distance as number;
    return fill(cues[cid].finding[locale], {
      n: s.affected_reps.length,
      total: s.evaluated,
      mag: fmt(c.unit === 'scale' ? Math.max(distance, 1) : distance, decimals, locale),
      value: fmt(s.value as number, decimals, locale),
    });
  };
  const finding = main ? findingFor(main) : null;

  let fatigue: string | null = null;
  if (breakdown !== null) {
    const tail = Object.entries(stats)
      .filter(([, s]) => s.affected_reps.some((r) => r > breakdown))
      .map(([cid]) => cues[cid].trend[locale]);
    const what = tail.join(msg.and) || msg.quality_drop;
    fatigue = fill(msg.held, { k: breakdown, next: breakdown + 1, what });
    if (velocityLoss !== null && velocityLoss >= 0.2) {
      fatigue += fill(msg.slower, { pct: fmt(velocityLoss * 100, 0, locale) });
    }
  }

  const partial = valid.flatMap((ok, i) => (ok ? [] : [i + 1]));
  let action: string;
  if (breakdown !== null) action = fill(msg.stop_or_lighten, { k: breakdown, total });
  else if (main) action = fill(msg.focus, { cue: cues[main].fix[locale] });
  else action = msg.progress;

  const strip = repResults.map((r, i) => {
    if (!valid[i]) return 'partial' as const;
    const warn = Object.values(r).some((v) => v.sub !== null && v.sub < FAULT_BELOW);
    return warn ? ('warn' as const) : ('ok' as const);
  });

  return {
    headline: `${setScore} · ${label}`,
    score: setScore,
    reps: total,
    valid_reps: total - partial.length,
    partial_reps: partial,
    good,
    main_fault: main,
    finding,
    fatigue,
    next_set: action,
    cue: main ? cues[main].fix[locale] : null,
    rep_strip: strip,
  };
}

/** Already-decided data, so an LLM (if used) only does the wording. */
export function llmPayload(
  spec: ExerciseSpec,
  feedback: Feedback,
  stats: Stats,
  velocityLoss: number | null,
  locale: Locale = 'en',
) {
  const main = feedback.main_fault;
  return {
    exercise: spec.name[locale],
    locale,
    set: {
      score: feedback.score,
      reps: feedback.reps,
      valid_reps: feedback.valid_reps,
      partial_reps: feedback.partial_reps,
    },
    good: feedback.good,
    main_fault:
      main === null
        ? null
        : { id: main, reps: stats[main].affected_reps, finding: feedback.finding },
    fatigue: feedback.fatigue,
    velocity_loss_last_rep: velocityLoss === null ? null : roundTo(velocityLoss, 2),
    cue: feedback.cue,
    next_set: feedback.next_set,
  };
}
