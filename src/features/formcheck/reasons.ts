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
  low_confidence: {
    title: "We couldn't see you clearly enough",
    explanation: 'Your reps were visible, but not clearly enough to score them.',
    fixes: ['Face a light source or switch on more lights', 'Film against a plain background'],
  },
  no_recording: {
    title: 'The video was not saved',
    explanation: 'This device could not keep the recording, so there was nothing to check.',
    fixes: ['Record the set again', 'Use the app on your phone if it keeps happening'],
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

/** Spanish wording keyed by analyzer reason ID; unknown IDs use the generic fallback. */
export const spanishReasons: Record<string, NotAssessableReason> = {
  body_not_visible: {
    title: 'No podemos ver todo tu cuerpo',
    explanation: 'Una parte de tu cuerpo salió del encuadre durante la serie.',
    fixes: ['Coloca el teléfono a 2–3 m', 'Mantén la cabeza y los pies dentro del encuadre'],
  },
  hips_not_visible: {
    title: 'No podemos ver tu cadera',
    explanation: 'La cadera quedó oculta y no pudimos evaluar el movimiento.',
    fixes: ['Graba de lado a la altura de la cadera', 'Retira lo que obstruya la vista'],
  },
  wrong_angle: {
    title: 'El ángulo de cámara no sirve para este ejercicio',
    explanation: 'Este ejercicio se evalúa desde otro ángulo.',
    fixes: ['Coloca el teléfono para grabar de lado'],
  },
  low_light: {
    title: 'La imagen está demasiado oscura',
    explanation: 'No había suficiente luz para seguir tu movimiento.',
    fixes: ['Ponte frente a una fuente de luz o enciende más luces'],
  },
  low_confidence: {
    title: 'No pudimos verte con suficiente claridad',
    explanation: 'Las repeticiones se veían, pero no con suficiente claridad para puntuarlas.',
    fixes: [
      'Ponte frente a una fuente de luz o enciende más luces',
      'Graba delante de un fondo liso',
    ],
  },
  no_recording: {
    title: 'El vídeo no se guardó',
    explanation: 'Este dispositivo no pudo conservar la grabación.',
    fixes: ['Graba la serie de nuevo', 'Usa la aplicación en tu teléfono si vuelve a ocurrir'],
  },
  multiple_people: {
    title: 'Hay más de una persona en el encuadre',
    explanation: 'No podemos determinar qué movimiento evaluar.',
    fixes: ['Pide a las demás personas que salgan del encuadre'],
  },
  too_short: {
    title: 'La grabación es demasiado corta',
    explanation: 'Necesitamos al menos una repetición completa.',
    fixes: [
      'Empieza a grabar antes de la primera repetición',
      'Detén la grabación después de la última',
    ],
  },
  no_reps_detected: {
    title: 'No encontramos repeticiones',
    explanation: 'No pudimos relacionar tu movimiento con este ejercicio.',
    fixes: ['Comprueba que sea el ejercicio correcto', 'Graba toda la serie dentro del encuadre'],
  },
};
export const spanishUnknownReason: NotAssessableReason = {
  title: 'No pudimos revisar esta grabación',
  explanation: 'No se pudo evaluar la grabación.',
  fixes: ['Intenta grabarla de nuevo'],
};
