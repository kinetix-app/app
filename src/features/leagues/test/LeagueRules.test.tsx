import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { LeagueRules } from '../components/LeagueRules';
import { nameSchema } from '../schemas';

test('explains scoring and calendar using the selected league timezone', () => {
  render(<LeagueRules timezone="Europe/Madrid" />);
  expect(screen.getByRole('header', { name: 'League rules' })).toBeTruthy();
  expect(screen.getByText(/confirmed repetitions × weight in kg/)).toBeTruthy();
  expect(screen.getByText(/highest rounded score/)).toBeTruthy();
  expect(screen.getByText(/Europe\/Madrid/)).toBeTruthy();
  expect(screen.getByText(/Monday 00:00 inclusive/)).toBeTruthy();
  expect(screen.getByText(/Equal totals share a rank/)).toBeTruthy();
});

test('allows names up to the backend limit', () => {
  expect(nameSchema.safeParse('a'.repeat(200)).success).toBe(true);
  expect(nameSchema.safeParse('a'.repeat(201)).success).toBe(false);
});
