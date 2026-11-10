import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SetFields } from '../components/SetFields';
import { cardioInput } from '../cardio';
import type { ActualSet } from '../sessionDraft';

test('one numeric time field formats digits and preserves duration for saving', () => {
  let current: ActualSet;
  function Editor() {
    const [set, setSet] = useState<ActualSet>({
      id: 'set-1',
      reps: '',
      value: '',
      unit: 'kg',
      distance: '1',
    });
    current = set;
    return (
      <SetFields
        cardio
        set={set}
        unit="kg"
        label="Set 1"
        disabled={false}
        onChange={setSet}
        onRemove={jest.fn()}
      />
    );
  }
  render(<Editor />);
  expect(screen.queryByLabelText('Set 1 hours')).toBeNull();
  const time = () => screen.getByLabelText('Set 1 time');
  fireEvent.changeText(time(), 'abc1230');
  expect(time().props.value).toBe('12:30');
  expect(cardioInput(current!)).toEqual({ duration_seconds: 750, distance_km: '1' });
  fireEvent.changeText(time(), '12345');
  expect(time().props.value).toBe('01:23:45');
  fireEvent.changeText(time(), '01:23:456');
  expect(time().props.value).toBe('12:34:56');
  expect(cardioInput(current!)?.duration_seconds).toBe(45296);
  fireEvent.changeText(time(), '1234567');
  expect(time().props.value).toBe('12:34:56');
  fireEvent.changeText(time(), '0000000');
  expect(time().props.value).toBe('12:34:56');
  fireEvent.changeText(time(), '10000');
  expect(time().props.value).toBe('01:00:00');
  expect(cardioInput(current!)?.duration_seconds).toBe(3600);
  fireEvent.changeText(time(), '5959');
  expect(time().props.value).toBe('59:59');
  fireEvent.changeText(time(), '995959');
  expect(time().props.value).toBe('99:59:59');
  fireEvent.changeText(time(), '99:59:599');
  expect(time().props.value).toBe('99:59:59');
  fireEvent.changeText(time(), '1260');
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Minutes and seconds must be between 00 and 59.',
  );
  expect(cardioInput(current!)).toBeNull();
  fireEvent.changeText(time(), '');
  expect(time().props.value).toBe('');
  expect(cardioInput(current!)).toBeNull();
  fireEvent.changeText(time(), '0');
  expect(time().props.value).toBe('00:00');
  expect(cardioInput(current!)?.duration_seconds).toBe(0);
});

test('fetched cardio guidance appears only as placeholders, including zero measurements', () => {
  const onChange = jest.fn();
  const props = {
    cardio: true,
    set: { id: 'set-1', reps: '', value: '', unit: 'kg' as const, distance: '' },
    unit: 'kg' as const,
    label: 'Set 1',
    disabled: false,
    onChange,
    onRemove: jest.fn(),
  };
  const view = render(<SetFields {...props} />);
  expect(screen.getByLabelText('Set 1 distance').props.placeholder).toBe('km');
  expect(screen.getByLabelText('Set 1 time').props.placeholder).toBe('mm:ss');
  view.rerender(
    <SetFields
      {...props}
      guidance={{ reps: null, weightKg: null, distanceKm: '1.25', durationSeconds: 750 }}
    />,
  );
  expect(screen.getByLabelText('Set 1 distance').props.placeholder).toBe('1.25');
  expect(screen.getByLabelText('Set 1 time').props.placeholder).toBe('00:12:30');
  expect(screen.getByLabelText('Set 1 distance').props.value).toBe('');
  expect(screen.getByLabelText('Set 1 time').props.value).toBe('');
  expect(screen.queryByText(/Previous result:/)).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
  expect(cardioInput(props.set)).toBeNull();
  view.rerender(
    <SetFields
      {...props}
      guidance={{ reps: null, weightKg: null, distanceKm: '0', durationSeconds: 0 }}
    />,
  );
  expect(screen.getByLabelText('Set 1 distance').props.placeholder).toBe('0');
  expect(screen.getByLabelText('Set 1 time').props.placeholder).toBe('00:00:00');
});
