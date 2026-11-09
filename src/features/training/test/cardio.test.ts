import { formatCardioDuration } from '../cardio';

test.each([
  [0, '00:00:00'],
  [90, '00:01:30'],
  [3599, '00:59:59'],
  [3600, '01:00:00'],
  [45296, '12:34:56'],
])('formats API duration %i as %s', (seconds, expected) => {
  expect(formatCardioDuration(seconds)).toBe(expected);
});
