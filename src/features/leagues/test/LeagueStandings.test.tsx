import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StandingsContent } from '../components/LeagueStandings';
import { standingsSchema } from '../schemas';

const data = standingsSchema.parse({
  timezone: 'Europe/Madrid',
  current_round_id: 2,
  rounds: [
    {
      id: 2,
      start_at: '2026-11-16T00:00:00Z',
      end_at: '2026-11-23T00:00:00Z',
      standings: [
        { user_id: 1, display_name: 'Alice', score: '9007199254740993', position: 1 },
        { user_id: 2, display_name: 'Bob', score: '0', position: 2 },
        { user_id: 3, display_name: null, score: '0', position: 2 },
      ],
      contributions: [
        {
          user_id: 1,
          local_day: '2026-11-16',
          score: '9007199254740993',
          calculation: {
            session_id: 4,
            volume_kg_reps: '500.00',
            duration_us: '3600000000',
            body_weight_kg: '80.00',
            formula_version: 'v1',
          },
        },
        {
          user_id: 2,
          local_day: '2026-11-16',
          score: '0',
          calculation: {
            session_id: 9,
            volume_kg_reps: '123.00',
            duration_us: '1',
            body_weight_kg: '42.00',
            formula_version: 'v1',
          },
        },
      ],
    },
    {
      id: 1,
      start_at: '2026-11-09T00:00:00Z',
      end_at: '2026-11-16T00:00:00Z',
      standings: [{ user_id: 1, display_name: 'Alice', score: '7', position: 1 }],
      contributions: [],
    },
  ],
  general: [{ user_id: 1, display_name: 'Alice', score: '9007199254741000', position: 1 }],
});

test('shows exact scores, tied zero members and only the viewer calculation', () => {
  render(<StandingsContent data={data} accountId={1} />);
  expect(screen.getByText('#1 Alice: 9007199254740993 points')).toBeTruthy();
  expect(screen.getByText('#2 Bob: 0 points')).toBeTruthy();
  expect(screen.getByText('#2 Member: 0 points')).toBeTruthy();
  expect(screen.getByText(/Body weight 80.00 kg/)).toBeTruthy();
  expect(screen.queryByText(/Body weight 42.00 kg/)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'General standings' }));
  expect(screen.getByText('#1 Alice: 9007199254741000 points')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: /Past round:/ }));
  expect(screen.getByText('#1 Alice: 7 points')).toBeTruthy();
  expect(screen.getByText('No daily contributions yet.')).toBeTruthy();
});
