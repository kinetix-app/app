import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SetFields } from '../components/SetFields';
import { cardioInput } from '../cardio';
import type { ActualSet } from '../sessionDraft';

jest.mock('@expo/vector-icons', () => ({ Feather: 'Icon' }));
const emptySet: ActualSet = { id: 'cardio-1', reps: '', value: '', unit: 'kg' };
const props = {
  cardio: true,
  unit: 'kg' as const,
  label: 'Set 1',
  disabled: false,
  onRemove: jest.fn(),
};

test('cardio fields retain independent distance and time inputs and serialize them without gym values', () => {
  let current = emptySet;
  function Editor() {
    const [set, setSet] = useState(emptySet);
    current = set;
    return <SetFields {...props} set={set} onChange={setSet} />;
  }
  render(<Editor />);
  expect(screen.queryByLabelText('Set 1 kg')).toBeNull();
  expect(screen.queryByLabelText('Set 1 reps')).toBeNull();
  for (const [field, value] of Object.entries({
    distance: '1.25',
    hours: '1',
    minutes: '2',
    seconds: '3',
  })) {
    fireEvent.changeText(screen.getByLabelText(`Set 1 ${field}`), value);
    expect(screen.getByLabelText(`Set 1 ${field}`).props.value).toBe(value);
  }
  expect(cardioInput(current)).toEqual({ distance_km: '1.25', duration_seconds: 3723 });
});

test('cardio guidance and reclassified gym history remain informational and never populate performed fields', () => {
  const onChange = jest.fn();
  const view = render(<SetFields {...props} set={emptySet} onChange={onChange} />);
  expect(screen.queryByText(/Previous result:/)).toBeNull();
  view.rerender(
    <SetFields
      {...props}
      set={emptySet}
      onChange={onChange}
      guidance={{ reps: null, weightKg: null, distanceKm: '0', durationSeconds: 0 }}
    />,
  );
  expect(screen.getByText('Previous result: 0 km · 0 seconds')).toBeTruthy();
  expect(screen.getByLabelText('Set 1 distance').props.value).toBe('');
  expect(onChange).not.toHaveBeenCalled();
  view.rerender(
    <SetFields
      {...props}
      set={{ ...emptySet, reps: '8', value: '40' }}
      onChange={onChange}
      guidance={{ reps: null, weightKg: '50' }}
    />,
  );
  expect(screen.getByText('Previous result: 50 kg · — reps')).toBeTruthy();
  expect(screen.getByText(/Previous entry: 40 kg · 8 reps/)).toBeTruthy();
  view.rerender(
    <SetFields
      {...props}
      disabled
      set={{ ...emptySet, reps: '8' }}
      onChange={onChange}
      guidance={{ reps: 12, weightKg: null }}
    />,
  );
  expect(screen.getByText('Previous result: — kg · 12 reps')).toBeTruthy();
  expect(screen.getByText(/Previous entry: — kg · 8 reps/)).toBeTruthy();
  expect(screen.getByLabelText('Set 1 distance').props.editable).toBe(false);
  view.rerender(
    <SetFields
      {...props}
      set={{ ...emptySet, value: '40' }}
      onChange={onChange}
      guidance={{ reps: null, weightKg: null }}
    />,
  );
  expect(screen.getByText(/Previous entry: 40 kg · — reps/)).toBeTruthy();
  expect(screen.queryByText(/Previous result:/)).toBeNull();
});
