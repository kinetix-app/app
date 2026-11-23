import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LeagueRules } from '../components/LeagueRules';
import { nameSchema } from '../schemas';

jest.mock('@expo/vector-icons/Ionicons', () => () => null);

test('opens dismissible rule tips without adding details to the rule rows', () => {
  render(<LeagueRules timezone="Europe/Madrid" />);
  expect(screen.getByRole('header', { name: 'League rules' })).toBeTruthy();
  expect(screen.getByText('Daily credit')).toBeTruthy();
  expect(screen.queryByText(/confirmed repetitions × weight in kg/)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'About score' }));
  expect(screen.getByText(/confirmed repetitions × weight in kg/)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Dismiss rule tip' }));
  expect(screen.queryByText(/confirmed repetitions × weight in kg/)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'About weekly rounds' }));
  expect(screen.getByText(/Monday 00:00 inclusive/)).toBeTruthy();
  expect(screen.getByText(/League timezone: Europe\/Madrid/)).toBeTruthy();
});

test('allows names up to the backend limit', () => {
  expect(nameSchema.safeParse('a'.repeat(200)).success).toBe(true);
  expect(nameSchema.safeParse('a'.repeat(201)).success).toBe(false);
});
