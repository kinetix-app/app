import { cardioInput, cardioValues } from '../cardio';

test('duration and distance retain explicit units, zero, and the integer duration bound', () => {
  expect(cardioInput({ distance: '0.00', hours: '0', minutes: '0', seconds: '0' })).toEqual({
    distance_km: '0.00',
    duration_seconds: 0,
  });
  const values = cardioValues(2147483647, '999999.99');
  expect(cardioInput(values)).toEqual({ duration_seconds: 2147483647, distance_km: '999999.99' });
  expect(cardioValues(null, null)).toEqual({ distance: '', hours: '', minutes: '', seconds: '' });
  expect(cardioValues(750, '1.25')).toEqual({
    distance: '1.25',
    hours: '0',
    minutes: '12',
    seconds: '30',
  });
});

test.each([
  {},
  { distance: '-1', hours: '0', minutes: '0', seconds: '0' },
  { distance: '0.001', hours: '0', minutes: '0', seconds: '0' },
  { distance: '1000000', hours: '0', minutes: '0', seconds: '0' },
  { distance: 'NaN', hours: '0', minutes: '0', seconds: '0' },
  { distance: '1', hours: '', minutes: '0', seconds: '0' },
  { distance: '1', hours: '0', minutes: '60', seconds: '0' },
  { distance: '1', hours: '0', minutes: '0', seconds: '60' },
  { distance: '1', hours: '596524', minutes: '0', seconds: '0' },
])('rejects invalid or incomplete cardio values %j without inventing missing zeros', (values) => {
  expect(cardioInput(values)).toBeNull();
});
