import { apiClient } from '@/services/apiClient';
import { trainingApi } from '../api';
import { exampleExercise, exampleRoutine } from './fixtures';
import { routineInputSchema, routineSchema, exercisePageSchema, exerciseSchema } from '../schemas';

jest.mock('@/config/environment', () => ({
  getApiBaseUrl: () => 'https://api.example',
  getAuthMode: () => 'basic',
}));

test('uses actual routine contracts and preserves stable slot IDs and decimal strings', async () => {
  const patch = jest.spyOn(apiClient, 'patch').mockResolvedValue(exampleRoutine);
  const input = {
    name: ' Push ',
    exercises: [{ id: 20, exercise_id: 1, sets: [{ reps: 8, weight_kg: '80.25' }] }],
  };
  await trainingApi.save(input, 10);
  expect(patch).toHaveBeenCalledWith(
    '/api/v1/routines/10',
    { ...input, name: 'Push' },
    { schema: routineSchema },
  );
  expect(routineSchema.parse(exampleRoutine).exercises[0].default_sets[0].weight_kg).toBe('80.00');
  patch.mockRestore();
});

test('filter is encoded and omission requests all accessible exercises', async () => {
  const get = jest
    .spyOn(apiClient, 'get')
    .mockResolvedValue({ items: [exampleExercise], limit: 20, offset: 0 });
  await trainingApi.exercises([], 0);
  expect(get.mock.calls[0][0]).toBe('/api/v1/exercises?limit=20&offset=0');
  await trainingApi.exercises([' CHEST & BACK '], 20);
  expect(get.mock.calls[1][0]).toBe(
    '/api/v1/exercises?limit=20&offset=20&body_part=CHEST%20%26%20BACK',
  );
  get.mockRestore();
});

test.each(['-1', 'NaN', 'Infinity', '', '1.0000001', '1000000'])(
  'rejects invalid planned kg input %s',
  (weight_kg) => {
    expect(() =>
      routineInputSchema.parse({
        name: 'Push',
        exercises: [{ exercise_id: 1, sets: [{ reps: 8, weight_kg }] }],
      }),
    ).toThrow();
  },
);

test('uses projected summaries and encodes a combined name/body-part search', async () => {
  const get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], limit: 20, offset: 0 });
  await trainingApi.exercises(['CHEST'], 0, undefined, ' Press & fly ');
  expect(get.mock.calls[0][0]).toBe(
    '/api/v1/exercises?limit=20&offset=0&body_part=CHEST&name=Press%20%26%20fly',
  );
  await trainingApi.routines(0, undefined, ' Push ');
  expect(get.mock.calls[1][0]).toBe('/api/v1/routines?limit=20&offset=0&name=Push');
  await trainingApi.bodyParts();
  expect(get.mock.calls[2][0]).toBe('/api/v1/exercises/body-parts');
  get.mockRestore();
});

test('accepts compact catalogue summaries while requiring instructions in the detail contract', () => {
  const summary = {
    id: 1,
    name: 'Bench press',
    activity_type: 'gym',
    body_parts: ['CHEST'],
    target_muscles: ['PECTORALIS'],
    equipments: ['BARBELL'],
    image_url: null,
  };
  expect(exercisePageSchema.parse({ items: [summary], limit: 20, offset: 0 }).items).toEqual([
    summary,
  ]);
  expect(() => exerciseSchema.parse(summary)).toThrow();
});

test('encodes multiple body parts as repeated parameters, deduplicated', async () => {
  const get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], limit: 20, offset: 0 });
  await trainingApi.exercises(['CHEST', 'BACK', 'CHEST'], 0);
  expect(get.mock.calls[0][0]).toBe(
    '/api/v1/exercises?limit=20&offset=0&body_part=BACK&body_part=CHEST',
  );
  get.mockRestore();
});

test('canonical weight validation accepts pound values within kg bounds and rejects excessive measurements', () => {
  expect(
    routineInputSchema.safeParse({
      name: 'Push',
      exercises: [
        { exercise_id: 1, sets: [{ reps: 8, weight: { value: '2000000', unit: 'lb' } }] },
      ],
    }).success,
  ).toBe(true);
  expect(
    routineInputSchema.safeParse({
      name: 'Push',
      exercises: [
        { exercise_id: 1, sets: [{ reps: 8, weight: { value: '3000000', unit: 'lb' } }] },
      ],
    }).success,
  ).toBe(false);
});

test('rejects ambiguous planned weight inputs instead of stripping one measurement', () => {
  expect(
    routineInputSchema.safeParse({
      name: 'Push',
      exercises: [
        {
          exercise_id: 1,
          sets: [{ reps: 8, weight_kg: '45.359237', weight: { value: '100', unit: 'lb' } }],
        },
      ],
    }).success,
  ).toBe(false);
});
