// Synthetic contract fixtures for feature tests; no personal records.
import type { Exercise, Routine } from './schemas';
export const exampleExercise: Exercise = {
  id: 1,
  name: 'Bench press',
  activity_type: 'gym',
  overview: 'Press with control.',
  target_muscles: ['PECTORALIS'],
  secondary_muscles: ['TRICEPS'],
  body_parts: ['CHEST'],
  equipments: ['BARBELL'],
  instructions: ['Lower, then press.'],
  image_url: 'https://media.example/bench.jpg',
  video_url: null,
};
export const exampleRoutine: Routine = {
  id: 10,
  name: 'Push',
  exercises: [
    {
      id: 20,
      exercise_order: 1,
      exercise: exampleExercise,
      notes: null,
      default_sets: [
        { set_number: 1, reps: 8, weight_kg: '80.00', duration_seconds: null, distance_km: null },
      ],
      sets: [
        { set_number: 1, reps: 12, weight_kg: '90.00', duration_seconds: null, distance_km: null },
      ],
      sets_source: 'latest_session',
    },
  ],
};
