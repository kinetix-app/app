/** @jest-environment jsdom */
import React from 'react';
import { Platform, Text } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import ExerciseDragList from '../components/ExerciseDragList.web';
import { WorkoutExerciseCard } from '../components/WorkoutEditor';
import { exampleExercise } from './fixtures';

const items = [{ id: 'bench' }, { id: 'squat' }];
const nativePlatform = Platform.OS;
afterEach(() => {
  Platform.OS = nativePlatform;
});

test('web drag containers group exercise controls with native fieldset semantics', () => {
  const view = render(
    <ExerciseDragList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <Text>{item.id}</Text>}
    />,
  );
  const rows = view.UNSAFE_root.findAll((node) => node.type === 'fieldset');
  expect(rows).toHaveLength(2);
  expect(rows[0].props['aria-label']).toBe('Exercise 1');
  expect(rows[0].props.tabIndex).toBeUndefined();
});

test('web card buttons reorder with arrow keys without intercepting set input or disabled changes', () => {
  Platform.OS = 'web';
  const onMove = jest.fn();
  const props = {
    exercise: exampleExercise,
    summary: <Text>1 set</Text>,
    onSets: jest.fn(),
    onDetails: jest.fn(),
    onMove,
    dragId: 'reorder-card-bench',
    disabled: false,
    onRemove: jest.fn(),
    onAddSet: jest.fn(),
    addSetLabel: 'Add set',
  };
  const view = render(<WorkoutExerciseCard {...props} />);
  const target = document.createElement('button');
  const preventDefault = jest.fn();
  const card = screen.getByLabelText(`Reorder ${exampleExercise.name}`);
  fireEvent(card, 'keyDown', { target, currentTarget: target, key: 'ArrowDown', preventDefault });
  fireEvent(card, 'keyDown', { target, currentTarget: target, key: 'ArrowUp', preventDefault });
  expect(onMove.mock.calls).toEqual([[1], [-1]]);
  expect(preventDefault).toHaveBeenCalledTimes(2);
  onMove.mockClear();
  const input = document.createElement('input');
  fireEvent(card, 'keyDown', {
    target: input,
    currentTarget: target,
    key: 'ArrowDown',
    preventDefault,
  });
  expect(onMove).not.toHaveBeenCalled();
  view.rerender(<WorkoutExerciseCard {...props} disabled />);
  fireEvent(screen.getByLabelText(`Reorder ${exampleExercise.name}`), 'keyDown', {
    target,
    currentTarget: target,
    key: 'ArrowDown',
    preventDefault,
  });
  expect(onMove).not.toHaveBeenCalled();
});
