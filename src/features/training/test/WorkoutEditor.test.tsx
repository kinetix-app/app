import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { WorkoutExerciseCard, WorkoutExerciseSummary } from '../components/WorkoutEditor';
import { exampleExercise } from './fixtures';

jest.mock('@expo/vector-icons', () => ({ Feather: 'Icon' }));

test('session cards drag from their name and expose accessible reorder actions without changing expansion', () => {
  const onDrag = jest.fn();
  const onMove = jest.fn();
  const onSets = jest.fn();
  const props = {
    exercise: exampleExercise,
    summary: <Text>1 set</Text>,
    onSets,
    onDetails: jest.fn(),
    onDrag,
    onMove,
    dragId: 'reorder-card-test',
    disabled: false,
    onRemove: jest.fn(),
    onAddSet: jest.fn(),
    addSetLabel: 'Add set to exercise 1',
  };
  const view = render(<WorkoutExerciseCard {...props} />);
  const name = screen.getByLabelText('Edit sets for Bench press');
  fireEvent(name, 'longPress');
  expect(onDrag).toHaveBeenCalledTimes(1);
  expect(onSets).not.toHaveBeenCalled();
  fireEvent(name, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  fireEvent(name, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  expect(onMove.mock.calls).toEqual([[1], [-1]]);
  view.rerender(<WorkoutExerciseCard {...props} disabled />);
  fireEvent(screen.getByLabelText('Edit sets for Bench press'), 'longPress');
  fireEvent(screen.getByLabelText('Edit sets for Bench press'), 'accessibilityAction', {
    nativeEvent: { actionName: 'increment' },
  });
  expect(onDrag).toHaveBeenCalledTimes(1);
  expect(onMove).toHaveBeenCalledTimes(2);
});

test('the shared summary shows live set counts and reps/kg ranges without inventing blank results', () => {
  const sets = [
    { reps: '8', value: '50', unit: 'kg' as const },
    { reps: '12', value: '60', unit: 'kg' as const },
  ];
  const view = render(<WorkoutExerciseSummary sets={sets} />);
  expect(screen.getByText('2 sets')).toBeTruthy();
  expect(screen.getByText('8–12 reps · 50–60 kg')).toBeTruthy();
  view.rerender(<WorkoutExerciseSummary sets={sets} savedCount={1} />);
  expect(screen.getByText('1 / 2 sets saved')).toBeTruthy();
  view.rerender(<WorkoutExerciseSummary sets={[{ reps: '', value: '', unit: 'kg' }]} />);
  expect(screen.getByText('— reps · — kg')).toBeTruthy();
});
