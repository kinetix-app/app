import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ExerciseDragHandle } from '../components/ExerciseDragHandle';

test('supports long press and accessible exercise reordering and blocks disabled changes', () => {
  const onDrag = jest.fn();
  const onMove = jest.fn();
  const props = { id: 'handle-1', label: 'Reorder bench press', disabled: false, onDrag, onMove };
  const view = render(<ExerciseDragHandle {...props} />);
  fireEvent(screen.getByLabelText(props.label), 'longPress');
  expect(onDrag).toHaveBeenCalledTimes(1);
  fireEvent(screen.getByLabelText(props.label), 'accessibilityAction', {
    nativeEvent: { actionName: 'increment' },
  });
  fireEvent(screen.getByLabelText(props.label), 'accessibilityAction', {
    nativeEvent: { actionName: 'decrement' },
  });
  expect(onMove.mock.calls).toEqual([[1], [-1]]);
  view.rerender(<ExerciseDragHandle {...props} disabled />);
  fireEvent(screen.getByLabelText(props.label), 'accessibilityAction', {
    nativeEvent: { actionName: 'increment' },
  });
  fireEvent(screen.getByLabelText(props.label), 'longPress');
  expect(onMove).toHaveBeenCalledTimes(2);
  expect(onDrag).toHaveBeenCalledTimes(1);
});
