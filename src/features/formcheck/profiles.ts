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
};

export type FormCheckProfile = {
  id: string;
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
    name: 'Back squat',
    exerciseNames: ['back squat', 'barbell back squat', 'barbell squat'],
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
        id: 'torso_lean',
        label: 'Torso',
        title: {
          one: 'Rep {reps} leaned too far forward',
          other: 'Reps {reps} leaned too far forward',
        },
        explanation: 'Your chest dropped toward the floor as you stood up.',
        repLabel: 'Lean',
        tip: 'Keep your chest up and drive your elbows forward.',
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
        id: 'hip_sag',
        label: 'Hips',
        title: { one: 'Rep {reps} let the hips sag', other: 'Reps {reps} let the hips sag' },
        explanation: 'Your hips dropped below the line from shoulders to ankles.',
        repLabel: 'Sag',
        tip: 'Squeeze your glutes and keep your body in one straight line.',
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
