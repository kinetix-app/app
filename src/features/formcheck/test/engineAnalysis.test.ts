import { bundledSpecs } from '../engine';
import { analyze } from '../engine/analyze';
import { parseSpec } from '../engine/spec';
import { load, toSeries } from '../engine/test/loadFixtures';
import { toFormAnalysis } from '../engineAnalysis';
import { formCheckProfiles, profileById, profileForExercise } from '../profiles';
import { genericReasons } from '../reasons';
import { formAnalysisSchema } from '../schemas';

const recording = { uri: 'file:///set.mp4', durationSeconds: 30 };

function analyzeFixture(name: string) {
  const fx = load(name);
  return analyze(toSeries(fx.series), parseSpec(fx.spec), 'en');
}

describe('profiles and engine specs', () => {
  it.each(formCheckProfiles.map((p) => [p.id, p] as const))(
    '%s has wording for every criterion its spec scores',
    (_, profile) => {
      const spec = bundledSpecs[profile.specId];
      const enabled = spec.criteria.filter((c) => !c.disabled).map((c) => c.id);
      expect(profile.checks.map((c) => c.id).sort()).toEqual([...enabled].sort());
    },
  );

  it('finds a profile for the catalogue names of the supported exercises', () => {
    expect(profileForExercise('Squat')?.id).toBe('back-squat');
    expect(profileForExercise('Push-up')?.id).toBe('push-up');
    expect(profileForExercise('Hammer Curl')?.id).toBe('hammer-curl');
    expect(profileForExercise('Seated Shoulder Press')?.id).toBe('seated-shoulder-press');
    expect(profileForExercise('Dumbbell One Arm Bent-over Row')?.id).toBe('dumbbell-row');
  });
});

describe('toFormAnalysis', () => {
  it('turns an assessed set into reps with the criteria they failed', () => {
    const result = analyzeFixture('synthetic-hammer_curl');
    const analysis = toFormAnalysis(result, profileById('hammer-curl')!, recording, new Date(0));
    expect(formAnalysisSchema.parse(analysis)).toEqual(analysis);
    if (analysis.status !== 'assessed' || !result.assessable) throw new Error('expected assessed');
    expect(analysis.reps).toHaveLength(8);
    expect(analysis.score).toBe(result.feedback.score);
    expect(analysis.source).toEqual({ engine: '0.2.0', spec: 'hammer_curl', specVersion: 2 });
    expect(analysis.reps[2].issues).toContain('top'); // the half rep of the synthetic plan
    expect(analysis.reps[0].issues).toEqual([]);
  });

  it('never reports disabled criteria', () => {
    const result = analyzeFixture('synthetic-hammer_curl-calibrated-es');
    const analysis = toFormAnalysis(result, profileById('hammer-curl')!, recording);
    if (analysis.status !== 'assessed') throw new Error('expected assessed');
    expect(analysis.reps.flatMap((r) => r.issues)).not.toContain('drift');
  });

  it.each([
    ['unassessable-not_side_view', 'hammer-curl', 'wrong_angle'],
    ['unassessable-missing_joints', 'dumbbell-row', 'body_not_visible'],
    ['unassessable-too_short', 'push-up', 'too_short'],
    ['unassessable-no_reps', 'hammer-curl', 'no_reps_detected'],
    ['real-squat-bad-subject_002', 'back-squat', 'body_not_visible'],
  ])('maps %s to a reason the app can explain', (fixture, profileId, reason) => {
    const analysis = toFormAnalysis(analyzeFixture(fixture), profileById(profileId)!, recording);
    expect(analysis).toMatchObject({ status: 'not_assessable', reasons: [reason] });
    expect(genericReasons[reason]).toBeDefined();
  });

  it('says the hips are hidden when they are what is missing', () => {
    const result = {
      exercise: 'back_squat',
      assessable: false as const,
      reason: 'missing_joints' as const,
      error: '',
      detail: { joints: ['knee' as const, 'hip' as const] },
      warnings: [],
    };
    expect(toFormAnalysis(result, profileById('back-squat')!, recording)).toMatchObject({
      reasons: ['hips_not_visible'],
    });
  });

  it('explains low confidence', () => {
    const result = {
      exercise: 'push_up',
      assessable: false as const,
      reason: 'low_confidence' as const,
      error: '',
      detail: { reps: 3 },
      warnings: [],
    };
    expect(toFormAnalysis(result, profileById('push-up')!, recording)).toMatchObject({
      reasons: ['low_confidence'],
    });
    expect(genericReasons.low_confidence.fixes.length).toBeGreaterThan(0);
  });
});

describe('strengths', () => {
  it('are the measured criteria that no rep failed', () => {
    const result = analyzeFixture('synthetic-push_up');
    const analysis = toFormAnalysis(result, profileById('push-up')!, recording, new Date(0));
    if (analysis.status !== 'assessed' || !result.assessable) throw new Error('expected assessed');
    const failedSomewhere = new Set(analysis.reps.flatMap((rep) => rep.issues));
    expect(analysis.strengths?.length).toBeGreaterThan(0);
    for (const id of analysis.strengths ?? []) {
      expect(failedSomewhere.has(id)).toBe(false);
      expect(result.reps.some((rep) => rep.criteria[id].sub !== null)).toBe(true);
    }
  });
});
