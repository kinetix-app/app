import type { FormCheckProfile } from './profiles';
import { genericReasons, unknownReason, type NotAssessableReason } from './reasons';
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
    }
  | { kind: 'not_assessable'; reasons: (NotAssessableReason & { id: string })[] };

/** "4", "4 and 5", "1, 3 and 4". */
export function listReps(reps: number[]): string {
  if (reps.length <= 1) return reps.join('');
  return `${reps.slice(0, -1).join(', ')} and ${reps[reps.length - 1]}`;
}

/** Turns stored ids into display text. Unknown ids degrade to generic text instead of failing. */
export function buildAnalysisView(profile: FormCheckProfile, analysis: FormAnalysis): AnalysisView {
  if (analysis.status === 'not_assessable') {
    return {
      kind: 'not_assessable',
      reasons: analysis.reasons.map((id) => ({
        id,
        ...(profile.reasonOverrides?.[id] ?? genericReasons[id] ?? unknownReason),
      })),
    };
  }
  const checks = new Map(profile.checks.map((check) => [check.id, check]));
  const affected = new Map<string, number[]>();
  for (const rep of analysis.reps)
    for (const id of rep.issues) affected.set(id, [...(affected.get(id) ?? []), rep.index]);
  const issues = [...affected.entries()]
    .map(([id, reps]) => {
      const check = checks.get(id);
      const text = check?.title[reps.length === 1 ? 'one' : 'other'] ?? 'Form issue on rep {reps}';
      return {
        id,
        label: check?.label ?? 'Form',
        title: text.replace('{reps}', listReps(reps)),
        explanation: check?.explanation ?? '',
        reps,
      };
    })
    .sort((a, b) => b.reps.length - a.reps.length);
  const first = (rep: { issues: string[] }) => checks.get(rep.issues[0])?.repLabel ?? 'Check';
  return {
    kind: 'assessed',
    repCount: analysis.reps.length,
    reps: analysis.reps.map((rep) => ({
      index: rep.index,
      ok: rep.issues.length === 0,
      label: rep.issues.length === 0 ? 'OK' : first(rep),
    })),
    issues,
    tip: issues.length ? (checks.get(issues[0].id)?.tip ?? null) : null,
  };
}
