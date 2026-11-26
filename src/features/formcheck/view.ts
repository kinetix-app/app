import { getTranslation } from '@/i18n/catalog';
import { type Language } from '@/i18n/Language';
import { bundledSpecs } from './engine';
import type { ExerciseSpec } from './engine';
import type { FormCheckProfile } from './profiles';
import {
  genericReasons,
  unknownReason,
  spanishReasons,
  spanishUnknownReason,
  type NotAssessableReason,
} from './reasons';
import type { FormAnalysis } from './schemas';

export type RepView = { index: number; ok: boolean; label: string };
export type IssueView = {
  id: string;
  label: string;
  title: string;
  explanation: string;
  reps: number[];
};
export type AnalysisView =
  | {
      kind: 'assessed';
      repCount: number;
      reps: RepView[];
      issues: IssueView[];
      /** Advice for the next set, taken from the check affecting most repetitions. */
      tip: string | null;
      /** 0–100 technique score, when the engine produced one. */
      score: number | null;
      /** What went well: checks passed on every rep (at most three). */
      praise: string[];
      /** Headline when no rep had an issue. */
      verdict: string;
    }
  | { kind: 'not_assessable'; reasons: (NotAssessableReason & { id: string })[] };

const MAX_PRAISE = 3;
const GREAT_SCORE = 90;

function reasonText(profile: FormCheckProfile, id: string, language: Language) {
  if (language === 'es') return spanishReasons[id] ?? spanishUnknownReason;
  return profile.reasonOverrides?.[id] ?? genericReasons[id] ?? unknownReason;
}

function repLabel(
  id: string,
  cues: ExerciseSpec['cues'],
  checks: Map<string, FormCheckProfile['checks'][number]>,
  language: Language,
) {
  if (language === 'es') return cues?.[id]?.live.es ?? 'Revisar';
  return checks.get(id)?.repLabel ?? 'Check';
}

function repStatusLabel(ok: boolean, language: Language) {
  if (ok) return getTranslation(language)('formcheck.view.good');
  return getTranslation(language)('formcheck.view.check');
}

function issueTitle(
  id: string,
  reps: number[],
  cues: ExerciseSpec['cues'],
  checks: Map<string, FormCheckProfile['checks'][number]>,
  language: Language,
) {
  if (language === 'es') {
    const plural = reps.length === 1 ? 'Repetición' : 'Repeticiones';
    return `${plural} {reps}: ${cues[id]?.live.es ?? 'revisa la técnica'}`;
  }
  return checks.get(id)?.title[reps.length === 1 ? 'one' : 'other'] ?? 'Form issue on rep {reps}';
}

function issueLabel(
  id: string,
  cues: ExerciseSpec['cues'],
  checks: Map<string, FormCheckProfile['checks'][number]>,
  language: Language,
) {
  if (language === 'es') return cues[id]?.label.es ?? 'Técnica';
  return checks.get(id)?.label ?? 'Form';
}

function praiseFor(
  id: string,
  cues: ExerciseSpec['cues'],
  checks: Map<string, FormCheckProfile['checks'][number]>,
  language: Language,
) {
  if (language === 'es') return cues[id]?.good.es;
  return checks.get(id)?.praise ?? cues[id]?.good.en;
}

function firstTip(
  issues: IssueView[],
  cues: ExerciseSpec['cues'],
  checks: Map<string, FormCheckProfile['checks'][number]>,
  language: Language,
) {
  const firstIssue = issues[0];
  if (!firstIssue) return null;
  if (language === 'es') return cues[firstIssue.id]?.fix.es ?? null;
  return checks.get(firstIssue.id)?.tip ?? null;
}

function verdict(score: number | null, language: Language) {
  if (score !== null && score >= GREAT_SCORE)
    return getTranslation(language)('formcheck.view.greatSet');
  return getTranslation(language)('formcheck.view.solidSet');
}

/** "4", "4 and 5", "1, 3 and 4". */
export function listReps(reps: number[], language: Language = 'en'): string {
  if (reps.length <= 1) return reps.join('');
  return `${reps.slice(0, -1).join(', ')} ${getTranslation(language)('formcheck.view.and')} ${reps.at(-1)}`;
}

/** Turns stored ids into display text. Unknown ids degrade to generic text instead of failing. */
export function buildAnalysisView(
  profile: FormCheckProfile,
  analysis: FormAnalysis,
  language: Language = 'en',
): AnalysisView {
  if (analysis.status === 'not_assessable') {
    return {
      kind: 'not_assessable',
      reasons: analysis.reasons.map((id) => ({
        id,
        ...reasonText(profile, id, language),
      })),
    };
  }
  const cues = bundledSpecs[profile.specId]?.cues ?? {};
  const checks = new Map(profile.checks.map((check) => [check.id, check]));
  const affected = new Map<string, number[]>();
  for (const rep of analysis.reps)
    for (const id of rep.issues) affected.set(id, [...(affected.get(id) ?? []), rep.index]);
  const issues = [...affected.entries()]
    .map(([id, reps]) => {
      const text = issueTitle(id, reps, cues, checks, language);
      return {
        id,
        label: issueLabel(id, cues, checks, language),
        title: text.replace('{reps}', listReps(reps, language)),
        explanation: language === 'es' ? '' : (checks.get(id)?.explanation ?? ''),
        reps,
      };
    })
    .sort((a, b) => b.reps.length - a.reps.length);
  const praise = (analysis.strengths ?? [])
    .map((id) => praiseFor(id, cues, checks, language))
    .filter((text): text is string => Boolean(text))
    .slice(0, MAX_PRAISE);
  const score = analysis.score ?? null;
  return {
    kind: 'assessed',
    repCount: analysis.reps.length,
    reps: analysis.reps.map((rep) => ({
      index: rep.index,
      ok: rep.issues.length === 0,
      label:
        rep.issues.length === 0
          ? repStatusLabel(true, language)
          : repLabel(rep.issues[0], cues, checks, language),
    })),
    issues,
    tip: firstTip(issues, cues, checks, language),
    score,
    praise,
    verdict: verdict(score, language),
  };
}
