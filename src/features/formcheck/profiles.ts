import type { SpecId } from './engine/specs';
import type { NotAssessableReason } from './reasons';

type Plural = { one: string; other: string };

/** One thing the analyzer can flag on a repetition. Wording lives here, not in the analyzer. */
export type FormCheck = {
  id: string;
  /** Short name, for example "Depth". */
  label: string;
  /** `{reps}` is replaced with the affected repetitions, for example "4 and 5". */
  title: Plural;
  explanation: string;
  /** Short word shown on an affected repetition. */
  repLabel: string;
  /** Advice for the next set. */
  tip: string;
  /** Said when the check passed on every rep; defaults to the spec's positive cue. */
  praise?: string;
};

export type FormCheckProfile = {
  id: string;
  /** The technique-engine spec that analyzes this exercise; check ids are its criterion ids. */
  specId: SpecId;
  name: string;
  /** Exercise names this profile applies to. Compared after normalising case and punctuation. */
  exerciseNames: string[];
  camera: { view: string; hint: string; checklist: string[] };
  checks: FormCheck[];
  /** Replaces the generic wording of a not-assessable reason for this exercise. */
  reasonOverrides?: Record<string, NotAssessableReason>;
};

export const formCheckProfiles: FormCheckProfile[] = [
  {
    id: 'back-squat',
    specId: 'back_squat',
    name: 'Back squat',
    exerciseNames: ['squat', 'back squat', 'barbell back squat', 'barbell squat'],
    camera: {
      view: 'side',
      hint: 'Place your phone at hip height, 2–3 m to your side, so your whole body fits in the frame.',
      checklist: ['Full body', 'Side view', 'Good light'],
    },
    checks: [
      {
        id: 'depth',
        label: 'Depth',
        title: {
          one: 'Rep {reps} stopped above parallel',
          other: 'Reps {reps} stopped above parallel',
        },
        explanation: 'Your hips stayed higher than your knees at the bottom.',
        repLabel: 'High',
        tip: 'Sit down between your heels and push the floor away.',
      },
      {
        id: 'hips_first',
        label: 'Torso',
        title: {
          one: 'Rep {reps} leaned too far forward',
          other: 'Reps {reps} leaned too far forward',
        },
        explanation: 'Your hips rose before your chest as you stood up.',
        repLabel: 'Lean',
        tip: 'Keep your chest up and drive your elbows forward.',
      },
      {
        id: 'heels',
        label: 'Heels',
        title: { one: 'Rep {reps} lifted the heels', other: 'Reps {reps} lifted the heels' },
        explanation: 'Your heels came off the floor during the rep.',
        repLabel: 'Heels',
        tip: 'Push the floor with your whole foot, from heel to toes.',
      },
      {
        id: 'lockout',
        label: 'Lockout',
        title: {
          one: 'Rep {reps} did not stand up fully',
          other: 'Reps {reps} did not stand up fully',
        },
        explanation: 'Your knees stayed bent at the top.',
        repLabel: 'Short',
        tip: 'Finish every rep standing tall.',
      },
      {
        id: 'tempo',
        label: 'Tempo',
        title: { one: 'Rep {reps} went down too fast', other: 'Reps {reps} went down too fast' },
        explanation: 'You dropped into the bottom instead of lowering with control.',
        repLabel: 'Fast',
        tip: 'Count «one, two» on the way down.',
      },
    ],
    reasonOverrides: {
      hips_not_visible: {
        title: "We can't see your hips",
        explanation: 'We need your hips and knees in view to check squat depth.',
        fixes: ['Film from the side at hip height', 'Move racks or people out of the way'],
      },
    },
  },
  {
    id: 'push-up',
    specId: 'push_up',
    name: 'Push-up',
    exerciseNames: ['push up', 'push-up', 'pushup'],
    camera: {
      view: 'side',
      hint: 'Place your phone on the floor 2 m to your side, so your whole body fits in the frame.',
      checklist: ['Full body', 'Side view', 'Good light'],
    },
    checks: [
      {
        id: 'depth',
        label: 'Depth',
        title: {
          one: 'Rep {reps} did not go low enough',
          other: 'Reps {reps} did not go low enough',
        },
        explanation: 'Your chest stayed far from the floor at the bottom.',
        repLabel: 'High',
        tip: 'Lower until your chest is a fist from the floor.',
      },
      {
        id: 'sag',
        label: 'Hips',
        title: { one: 'Rep {reps} let the hips sag', other: 'Reps {reps} let the hips sag' },
        explanation: 'Your hips dropped below the line from shoulders to ankles.',
        repLabel: 'Sag',
        tip: 'Squeeze your glutes and keep your body in one straight line.',
      },
      {
        id: 'pike',
        label: 'Hips',
        title: { one: 'Rep {reps} piked the hips up', other: 'Reps {reps} piked the hips up' },
        explanation: 'Your hips rose above the line from shoulders to ankles.',
        repLabel: 'Pike',
        tip: 'Lower your hips until shoulders, hips and ankles line up.',
      },
      {
        id: 'lockout',
        label: 'Lockout',
        title: {
          one: 'Rep {reps} did not straighten the arms',
          other: 'Reps {reps} did not straighten the arms',
        },
        explanation: 'Your elbows stayed bent at the top.',
        repLabel: 'Short',
        tip: 'Fully straighten your arms at the top, pushing the floor away.',
      },
      {
        id: 'tempo',
        label: 'Tempo',
        title: { one: 'Rep {reps} went down too fast', other: 'Reps {reps} went down too fast' },
        explanation: 'You dropped instead of lowering with control.',
        repLabel: 'Fast',
        tip: 'Count «one, two» on the way down.',
      },
    ],
  },
  {
    id: 'hammer-curl',
    specId: 'hammer_curl',
    name: 'Hammer curl',
    exerciseNames: ['hammer curl', 'dumbbell hammer curl', 'biceps curl', 'dumbbell curl'],
    camera: {
      view: 'side',
      hint: 'Place your phone 2 m to your side, with your working arm toward it and shoulder to hip in the frame.',
      checklist: ['Working arm toward the phone', 'Side view', 'Good light'],
    },
    checks: [
      {
        id: 'top',
        label: 'Range',
        title: {
          one: 'Rep {reps} did not curl all the way up',
          other: 'Reps {reps} did not curl all the way up',
        },
        explanation: 'The weight stopped well below your shoulder.',
        repLabel: 'Half',
        tip: 'Curl until the dumbbell reaches shoulder height.',
      },
      {
        id: 'extension',
        label: 'Bottom',
        title: {
          one: 'Rep {reps} did not straighten the arm',
          other: 'Reps {reps} did not straighten the arm',
        },
        explanation: 'Your elbow stayed bent at the bottom.',
        repLabel: 'Short',
        tip: 'Straighten your arm fully before curling again.',
      },
      {
        id: 'swing',
        label: 'Swing',
        title: { one: 'Rep {reps} swung the torso', other: 'Reps {reps} swung the torso' },
        explanation: 'You leaned back to help lift the weight.',
        repLabel: 'Swing',
        tip: "Don't lean back to lift it: drop the weight if you need to.",
      },
      {
        id: 'tempo',
        label: 'Tempo',
        title: { one: 'Rep {reps} dropped the weight', other: 'Reps {reps} dropped the weight' },
        explanation: 'You lowered the weight too fast.',
        repLabel: 'Fast',
        tip: 'Count «one, two» on the way down.',
      },
    ],
  },
  {
    id: 'seated-shoulder-press',
    specId: 'seated_shoulder_press',
    name: 'Seated shoulder press',
    exerciseNames: [
      'seated shoulder press',
      'dumbbell shoulder press',
      'shoulder press',
      'military press',
    ],
    camera: {
      view: 'side',
      hint: 'Place your phone 2 m to your side at chest height, with your arms fully extended still in the frame.',
      checklist: ['Arms in the frame', 'Side view', 'Good light'],
    },
    checks: [
      {
        id: 'lockout',
        label: 'Lockout',
        title: {
          one: 'Rep {reps} stopped short of lockout',
          other: 'Reps {reps} stopped short of lockout',
        },
        explanation: 'The dumbbells stopped before your arms were straight.',
        repLabel: 'Short',
        tip: 'Press until your arms are fully straight overhead.',
      },
      {
        id: 'depth',
        label: 'Bottom',
        title: {
          one: 'Rep {reps} did not come down to the shoulders',
          other: 'Reps {reps} did not come down to the shoulders',
        },
        explanation: 'The dumbbells stayed high above your shoulders.',
        repLabel: 'High',
        tip: 'Lower the dumbbells to shoulder height.',
      },
      {
        id: 'stack',
        label: 'Path',
        title: {
          one: 'Rep {reps} finished in front of the shoulders',
          other: 'Reps {reps} finished in front of the shoulders',
        },
        explanation: 'The dumbbells drifted forward instead of ending over your shoulders.',
        repLabel: 'Forward',
        tip: 'Finish with the dumbbells right over your shoulders, not in front.',
      },
      {
        id: 'arch',
        label: 'Back',
        title: { one: 'Rep {reps} arched the back', other: 'Reps {reps} arched the back' },
        explanation: 'You leaned back to help press the weight.',
        repLabel: 'Arch',
        tip: "Keep your back on the bench and your core tight; don't lean back.",
      },
      {
        id: 'tempo',
        label: 'Tempo',
        title: { one: 'Rep {reps} dropped the weight', other: 'Reps {reps} dropped the weight' },
        explanation: 'You lowered the weight too fast.',
        repLabel: 'Fast',
        tip: 'Count «one, two» on the way down.',
      },
    ],
  },
  {
    id: 'dumbbell-row',
    specId: 'dumbbell_row',
    name: 'One-arm dumbbell row',
    exerciseNames: [
      'dumbbell one arm bent over row',
      'one arm bent over row',
      'dumbbell row',
      'one arm dumbbell row',
    ],
    camera: {
      view: 'side',
      hint: 'Place your phone 2 m to your side, with your working arm toward it and your whole body in the frame.',
      checklist: ['Working arm toward the phone', 'Side view', 'Good light'],
    },
    checks: [
      {
        id: 'pull',
        label: 'Range',
        title: { one: 'Rep {reps} was a short pull', other: 'Reps {reps} were short pulls' },
        explanation: 'Your elbow stopped before passing the line of your back.',
        repLabel: 'Short',
        tip: 'Pull until your elbow passes the line of your back.',
      },
      {
        id: 'extension',
        label: 'Bottom',
        title: {
          one: 'Rep {reps} did not straighten the arm',
          other: 'Reps {reps} did not straighten the arm',
        },
        explanation: 'Your elbow stayed bent at the bottom.',
        repLabel: 'Bent',
        tip: 'Let your arm straighten fully at the bottom before the next pull.',
      },
      {
        id: 'torso_angle',
        label: 'Torso',
        title: { one: 'Rep {reps} was too upright', other: 'Reps {reps} were too upright' },
        explanation: 'Your torso was not leaning far enough forward.',
        repLabel: 'Upright',
        tip: 'Lean your torso further, close to horizontal, back straight.',
      },
      {
        id: 'tempo',
        label: 'Tempo',
        title: { one: 'Rep {reps} dropped the weight', other: 'Reps {reps} dropped the weight' },
        explanation: 'You lowered the weight too fast.',
        repLabel: 'Fast',
        tip: "Lower the dumbbell over a second; don't drop it.",
      },
    ],
  },
];

const normalize = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** The profile for an exercise, or undefined when form check is not available for it. */
export function profileForExercise(
  exerciseName: string,
  profiles: FormCheckProfile[] = formCheckProfiles,
): FormCheckProfile | undefined {
  const name = normalize(exerciseName);
  return profiles.find((profile) => profile.exerciseNames.some((n) => normalize(n) === name));
}

export function profileById(
  id: string,
  profiles: FormCheckProfile[] = formCheckProfiles,
): FormCheckProfile | undefined {
  return profiles.find((profile) => profile.id === id);
}
