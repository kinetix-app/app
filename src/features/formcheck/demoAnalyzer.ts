import type { FormAnalyzer } from './analyzer';
import type { FormCheckProfile } from './profiles';
import type { FormAnalysis, Recording } from './schemas';

export type DemoScenario = 'issues' | 'clean' | 'not_assessable' | 'failure';

const REPS = 6;
const now = () => new Date().toISOString();

function result(
  scenario: Exclude<DemoScenario, 'failure'>,
  profile: FormCheckProfile,
  recording: Recording,
): FormAnalysis {
  const base = {
    profileId: profile.id,
    analyzedAt: now(),
    durationSeconds: recording.durationSeconds,
  };
  if (scenario === 'not_assessable')
    return { ...base, status: 'not_assessable', reasons: ['hips_not_visible', 'low_light'] };
  const check = profile.checks[0]?.id;
  return {
    ...base,
    status: 'assessed',
    reps: Array.from({ length: REPS }, (_, i) => ({
      index: i + 1,
      issues: scenario === 'issues' && check && (i === 3 || i === 4) ? [check] : [],
    })),
  };
}

/**
 * Placeholder analyzer that looks at no video. It cycles through the scenarios so every screen
 * state can be seen. It is not a form check and must never be presented as one.
 */
export function createDemoAnalyzer(
  scenarios: DemoScenario[] = ['issues', 'clean', 'not_assessable', 'failure'],
): FormAnalyzer {
  let next = 0;
  return {
    isDemo: true,
    async analyze({ profile, recording }) {
      const scenario = scenarios[next++ % scenarios.length];
      await new Promise((resolve) => setTimeout(resolve, 1200));
      if (scenario === 'failure') throw new Error('Demo analysis failure');
      return result(scenario, profile, recording);
    },
  };
}
