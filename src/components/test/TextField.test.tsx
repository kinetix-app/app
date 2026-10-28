import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TextField } from '../TextField';
import { palette } from '@/theme/tokens';

test('focus and mouse hover highlight the field and forward focus/blur callbacks', () => {
  const onFocus = jest.fn();
  const onBlur = jest.fn();
  render(<TextField accessibilityLabel="Name" theme="light" onFocus={onFocus} onBlur={onBlur} />);
  const input = screen.getByLabelText('Name');
  const container = screen.root.findAll(
    (node) => typeof node.type === 'string' && node.props.onPointerEnter,
  )[0];
  const p = palette('light');
  expect(container).toHaveStyle({ borderColor: p['line-strong'] });
  fireEvent(input, 'focus', { nativeEvent: {} });
  expect(container).toHaveStyle({ borderColor: p.focus });
  expect(onFocus).toHaveBeenCalledTimes(1);
  fireEvent(input, 'blur', { nativeEvent: {} });
  expect(onBlur).toHaveBeenCalledTimes(1);
  expect(container).toHaveStyle({ borderColor: p['line-strong'] });
  fireEvent(container, 'pointerEnter', { nativeEvent: { pointerType: 'touch' } });
  expect(container).toHaveStyle({ borderColor: p['line-strong'] });
  fireEvent(container, 'pointerEnter', { nativeEvent: { pointerType: 'mouse' } });
  expect(container).toHaveStyle({ borderColor: p.focus });
  fireEvent(container, 'pointerLeave', { nativeEvent: { pointerType: 'touch' } });
  expect(container).toHaveStyle({ borderColor: p.focus });
  fireEvent(container, 'pointerLeave', { nativeEvent: { pointerType: 'mouse' } });
  expect(container).toHaveStyle({ borderColor: p['line-strong'] });
});
test('invalid styling takes priority over focus; disabled fields do not highlight', () => {
  const view = render(<TextField accessibilityLabel="Name" invalid theme="dark" />);
  const input = screen.getByLabelText('Name');
  fireEvent(input, 'focus', { nativeEvent: {} });
  expect(
    screen.root.findAll((node) => typeof node.type === 'string' && node.props.onPointerEnter)[0],
  ).toHaveStyle({
    borderColor: palette('dark').danger,
  });
  fireEvent(input, 'blur', { nativeEvent: {} });
  view.rerender(
    <TextField
      accessibilityLabel="Name"
      editable={false}
      theme="dark"
      placeholderTextColor="red"
      selectionColor="blue"
      underlineColorAndroid="green"
    />,
  );
  fireEvent(
    screen.root.findAll((node) => typeof node.type === 'string' && node.props.onPointerEnter)[0],
    'pointerEnter',
    {
      nativeEvent: { pointerType: 'mouse' },
    },
  );
  expect(
    screen.root.findAll((node) => typeof node.type === 'string' && node.props.onPointerEnter)[0],
  ).toHaveStyle({
    borderColor: palette('dark')['line-strong'],
    opacity: 0.6,
  });
  expect(screen.getByLabelText('Name').props).toMatchObject({
    placeholderTextColor: 'red',
    selectionColor: 'blue',
    underlineColorAndroid: 'green',
  });
});
