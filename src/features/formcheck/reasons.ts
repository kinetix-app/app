/** Why a recording could not be assessed. Profiles can override the wording of any reason. */
export type NotAssessableReason = {
  title: string;
  explanation: string;
  /** What the user can change before recording again. */
  fixes: string[];
};

export const genericReasons: Record<string, NotAssessableReason> = {
  body_not_visible: {
    title: "We can't see your whole body",
    explanation: 'Part of your body left the frame during the set.',
    fixes: ['Place the phone 2–3 m away', 'Keep your head and feet in the frame'],
  },
  hips_not_visible: {
    title: "We can't see your hips",
    explanation: 'Your hips were hidden, so we could not judge your movement.',
    fixes: ['Film from the side at hip height', 'Move anything that blocks the view'],
  },
  wrong_angle: {
    title: 'The camera angle does not fit this exercise',
    explanation: 'This exercise is checked from a different side than the one filmed.',
    fixes: ['Turn the phone so it films you from the side'],
  },
  low_light: {
    title: 'The picture is too dark',
    explanation: 'There was not enough light to follow your movement.',
    fixes: ['Face a light source or switch on more lights'],
  },
  multiple_people: {
    title: 'More than one person is in the frame',
    explanation: 'We cannot tell whose movement to check.',
    fixes: ['Ask others to stay out of the frame'],
  },
  too_short: {
    title: 'The recording is too short',
    explanation: 'We need at least one full repetition to check.',
    fixes: ['Start recording before your first rep', 'Stop after your last rep'],
  },
  no_reps_detected: {
    title: "We couldn't find any repetitions",
    explanation: 'We could not match your movement to this exercise.',
    fixes: ['Check that this is the right exercise', 'Record the full set in the frame'],
  },
};

/** Used when an analyzer reports a reason that no profile or catalogue knows. */
export const unknownReason: NotAssessableReason = {
  title: 'We could not check this recording',
  explanation: 'The recording could not be assessed.',
  fixes: ['Try recording again'],
};
