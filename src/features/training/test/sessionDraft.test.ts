import {
  createSessionDraft,
  draftSnapshot,
  displayWeight,
  freezeSession,
  sessionDraftSchema,
} from '../sessionDraft';
import { exampleRoutine } from '../fixtures';

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '3e17c183-38a9-4b5c-b953-7ae49433af17'),
}));
test('both origins use a versioned account draft and routine actuals begin empty', () => {
  const blank = createSessionDraft(11);
  expect(blank.exercises).toEqual([]);
  const routine = createSessionDraft(11, {
    ...exampleRoutine,
    exercises: [...exampleRoutine.exercises, { ...exampleRoutine.exercises[0], id: 21 }],
  });
  expect(routine.exercises).toHaveLength(2);
  expect(routine.exercises.every((slot) => !('sourceSlotId' in slot))).toBe(true);
  expect(routine.exercises[0].guidance[0].weightKg).toBe('90.00');
  expect(routine.exercises[0].sets[0]).toMatchObject({
    value: '',
    reps: '',
    unit: 'kg',
  });
  expect(routine.routineId).toBe(10);
  expect(sessionDraftSchema.parse(routine)).toEqual(routine);
});
test('unit presentation retains original decimal input and never drifts on toggles', () => {
  const original = { value: '100.00', unit: 'lb' as const };
  for (let i = 0; i < 30; i++) {
    expect(displayWeight(original.value, original.unit, 'kg')).toBe('45.36');
    expect(displayWeight(original.value, original.unit, 'lb')).toBe('100.00');
  }
  expect(displayWeight('1.', 'kg', 'kg')).toBe('1.');
  expect(displayWeight('bad', 'kg', 'lb')).toBe('bad');
  expect(original.value).toBe('100.00');
});
test('finish freezes original units, UUID and finish instant for identical retry', () => {
  const draft = createSessionDraft(11, exampleRoutine);
  draft.exercises[0].sets[0] = {
    id: 'set',
    saved: true,
    value: '100.00',
    unit: 'lb',
    reps: '8',
  };
  const payload = freezeSession(draft, '2099-10-24T18:00:00Z');
  expect(payload.exercises[0]).toEqual({
    exercise_id: 1,
    sets: [{ reps: 8, weight: { value: '100.00', unit: 'lb' } }],
  });
  expect(freezeSession({ ...draft, frozen: payload }, '2100-01-01T00:00:00Z')).toBe(payload);
  expect(payload.client_session_id).toBe(draft.clientId);
});
test.each([
  ['', '8'],
  ['20', ''],
  ['NaN', '8'],
  ['-1', '8'],
  ['0', '1.5'],
  ['0', '0'],
  ['999999999', '8'],
])('invalid or partial actual %s/%s cannot be silently submitted', (value, reps) => {
  const draft = createSessionDraft(11, exampleRoutine);
  draft.exercises[0].sets[0] = { id: 'set', value, unit: 'kg', reps, saved: true };
  expect(() => freezeSession(draft, '2099-10-24T18:00:00Z')).toThrow();
});

test('sync preserves the last confirmed result until the changed set is ticked again', () => {
  const draft = createSessionDraft(11, exampleRoutine);
  draft.exercises[0].sets[0] = {
    id: 'set',
    value: '110',
    reps: '9',
    unit: 'kg',
    saved: false,
    confirmed: { value: '100.00', reps: '8', unit: 'lb' },
  };
  expect(draftSnapshot(draft).exercises[0].sets[0]).toMatchObject({
    completed: true,
    reps: 8,
    weight: { value: '100.00', unit: 'lb' },
  });
  draft.exercises[0].sets[0].saved = true;
  expect(draftSnapshot(draft).exercises[0].sets[0]).toMatchObject({
    completed: true,
    reps: 9,
    weight: { value: '110', unit: 'kg' },
  });
});

test('partial completion keeps exercise order and only confirmed sets without routine-slot references', () => {
  const draft = createSessionDraft(11, exampleRoutine);
  const slot = draft.exercises[0];
  slot.sets = [
    { id: 'done', value: '10', reps: '8', unit: 'kg', saved: true },
    { id: 'partial', value: 'invalid', reps: '', unit: 'kg', saved: false },
  ];
  draft.exercises.push({
    ...slot,
    id: 'second',
    sets: [{ id: 'unfulfilled', value: '', reps: '', unit: 'kg' }],
  });
  const frozen = freezeSession(draft, '2099-10-24T18:00:00Z');
  expect(frozen.exercises.map((exercise) => exercise.sets.length)).toEqual([1, 0]);
  expect(frozen.exercises.every((exercise) => !('routine_exercise_id' in exercise))).toBe(true);
  expect(draftSnapshot(draft, true).exercises.map((exercise) => exercise.sets.length)).toEqual([
    1, 0,
  ]);
  expect(frozen.routine_id).toBe(exampleRoutine.id);
});
