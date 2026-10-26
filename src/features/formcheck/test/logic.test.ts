import { createDemoAnalyzer } from '../demoAnalyzer';
import { formCheckProfiles, profileForExercise, type FormCheckProfile } from '../profiles';
import { formAnalysisSchema, type FormAnalysis } from '../schemas';
import { buildAnalysisView, listReps } from '../view';

const squat = formCheckProfiles[0];
const base = { profileId: squat.id, analyzedAt: '2026-10-25T10:00:00.000Z', durationSeconds: 20 };

test('finds a profile by exercise name ignoring case and punctuation', () => {
  expect(profileForExercise('Push-up')?.id).toBe('push-up');
  expect(profileForExercise('PUSH UP')?.id).toBe('push-up');
  expect(profileForExercise('Barbell Back Squat')?.id).toBe('back-squat');
  expect(profileForExercise('Bench press')).toBeUndefined();
});

test('lists repetitions in plain language', () => {
  expect(listReps([4])).toBe('4');
  expect(listReps([4, 5])).toBe('4 and 5');
  expect(listReps([1, 3, 4])).toBe('1, 3 and 4');
});

test('groups failed checks, orders them by reach and offers the tip of the main issue', () => {
  const analysis: FormAnalysis = {
    ...base,
    status: 'assessed',
    reps: [
      { index: 1, issues: [] },
      { index: 2, issues: ['torso_lean'] },
      { index: 3, issues: ['depth', 'torso_lean'] },
      { index: 4, issues: ['depth'] },
      { index: 5, issues: ['torso_lean'] },
    ],
  };
  const view = buildAnalysisView(squat, analysis);
  if (view.kind !== 'assessed') throw new Error('expected an assessed view');
  expect(view.repCount).toBe(5);
  expect(view.issues.map((issue) => issue.id)).toEqual(['torso_lean', 'depth']);
  expect(view.issues[0].title).toBe('Reps 2, 3 and 5 leaned too far forward');
  expect(view.issues[1].title).toBe('Reps 3 and 4 stopped above parallel');
  expect(view.reps.map((rep) => rep.label)).toEqual(['OK', 'Lean', 'High', 'High', 'Lean']);
  expect(view.tip).toBe(squat.checks[1].tip);
});

test('uses the singular title for one repetition and no tip when nothing failed', () => {
  const one = buildAnalysisView(squat, {
    ...base,
    status: 'assessed',
    reps: [{ index: 2, issues: ['depth'] }],
  });
  if (one.kind !== 'assessed') throw new Error('expected an assessed view');
  expect(one.issues[0].title).toBe('Rep 2 stopped above parallel');
  const clean = buildAnalysisView(squat, {
    ...base,
    status: 'assessed',
    reps: [{ index: 1, issues: [] }],
  });
  if (clean.kind !== 'assessed') throw new Error('expected an assessed view');
  expect(clean.issues).toEqual([]);
  expect(clean.tip).toBeNull();
});

test('degrades to generic text for ids no profile knows', () => {
  const view = buildAnalysisView(squat, {
    ...base,
    status: 'assessed',
    reps: [{ index: 1, issues: ['made_up'] }],
  });
  if (view.kind !== 'assessed') throw new Error('expected an assessed view');
  expect(view.issues[0].title).toBe('Form issue on rep 1');
  expect(view.reps[0].label).toBe('Check');
  const unknown = buildAnalysisView(squat, { ...base, status: 'not_assessable', reasons: ['x'] });
  if (unknown.kind !== 'not_assessable') throw new Error('expected a not-assessable view');
  expect(unknown.reasons[0].title).toBe('We could not check this recording');
});

test('lets a profile reword a reason and falls back to the generic catalogue', () => {
  const custom: FormCheckProfile = {
    ...squat,
    reasonOverrides: {
      low_light: { title: 'Custom', explanation: 'Custom text', fixes: ['Custom fix'] },
    },
  };
  const view = buildAnalysisView(custom, {
    ...base,
    status: 'not_assessable',
    reasons: ['low_light', 'too_short'],
  });
  if (view.kind !== 'not_assessable') throw new Error('expected a not-assessable view');
  expect(view.reasons.map((reason) => reason.title)).toEqual([
    'Custom',
    'The recording is too short',
  ]);
});

test('demo analyzer cycles scenarios and returns valid results', async () => {
  jest.useFakeTimers();
  const analyzer = createDemoAnalyzer(['issues', 'clean', 'not_assessable', 'failure']);
  const recording = { uri: null, durationSeconds: 20 };
  const run = async () => {
    const pending = analyzer.analyze({ profile: squat, recording });
    const settled = pending.then(
      (value) => value,
      (error: unknown) => error,
    );
    await jest.advanceTimersByTimeAsync(1500);
    return settled;
  };
  const issues = (await run()) as FormAnalysis;
  expect(formAnalysisSchema.parse(issues)).toBeTruthy();
  expect(issues.status === 'assessed' && issues.reps.filter((r) => r.issues.length)).toHaveLength(
    2,
  );
  const clean = (await run()) as FormAnalysis;
  expect(clean.status === 'assessed' && clean.reps.every((rep) => !rep.issues.length)).toBe(true);
  expect(((await run()) as FormAnalysis).status).toBe('not_assessable');
  expect(await run()).toBeInstanceOf(Error);
  expect(analyzer.isDemo).toBe(true);
  jest.useRealTimers();
});
