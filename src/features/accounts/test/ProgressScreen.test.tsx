import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { calendarLabel, shiftCalendarMonth } from '@/components/CalendarGrid';
import { ApiError } from '@/services/apiClient';
import { ProgressScreen } from '../components/ProgressScreen';
import { measurementKey, progressApi } from '../progressApi';
import { completeAccount } from './fixtures';
import { displayProgressDate, todayForProfile } from '../progressForm';
import type { BodyMeasurement } from '../progressSchemas';

const requestId = '3e17c183-38a9-4b5c-b953-7ae49433af17';

jest.mock('expo-crypto', () => ({ randomUUID: () => '3e17c183-38a9-4b5c-b953-7ae49433af17' }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('../progressApi', () => ({
  ...jest.requireActual('../progressApi'),
  progressApi: {
    measurements: jest.fn(),
    record: jest.fn(),
    target: jest.fn(),
    saveTarget: jest.fn(),
  },
}));

const item: BodyMeasurement = {
  id: 2,
  date: '2026-01-02',
  weight_kg: '75.000000',
  height_cm: null,
  body_fat_percentage: null,
  muscle_mass_kg: null,
  waist_cm: null,
  chest_cm: null,
  arm_cm: null,
  thigh_cm: null,
};

function open() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={cache}>
      <ProgressScreen account={completeAccount} onClose={() => {}} />
    </QueryClientProvider>,
  );
  return cache;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(progressApi.measurements).mockResolvedValue({ items: [] });
  jest.mocked(progressApi.target).mockResolvedValue({ objective: 'gain_weight', target: null });
});

test('distinguishes failed loading from an empty plotted series and retries', async () => {
  jest.mocked(progressApi.measurements).mockRejectedValueOnce(new Error('offline'));
  open();
  expect(await screen.findByText('Could not load measurements.')).toBeTruthy();
  expect(screen.queryByText('No weight measurements yet.')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Retry. Could not load measurements.' }));
  expect(await screen.findByText('No weight measurements yet.')).toBeTruthy();
  expect(screen.getByTestId('body-measurement-chart')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^\d{4}-\d{2}-\d{2},/ })).toBeNull();
});

test('keeps a failed check-in and its request ID, then refreshes history and profile after saving', async () => {
  jest
    .mocked(progressApi.record)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(item);
  const cache = open();
  const invalidate = jest.spyOn(cache, 'invalidateQueries');
  await screen.findByText('No weight measurements yet.');
  fireEvent.press(screen.getByRole('button', { name: 'Log measurements' }));
  fireEvent.press(screen.getByRole('button', { name: 'Measurement date' }));
  expect(screen.getByRole('header', { name: 'Measurement date' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Save measurements' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('button', { name: 'Save measurements' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Measurement date' }));
  expect(screen.getByRole('button', { name: 'Next month' }).props.accessibilityState.disabled).toBe(
    true,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
  const recordedDate = shiftCalendarMonth(todayForProfile(completeAccount.profile.timezone), -1);
  fireEvent.press(screen.getByRole('button', { name: `Select ${calendarLabel(recordedDate)}` }));
  fireEvent.changeText(screen.getByLabelText('Weight (kg)'), '75');
  fireEvent.press(screen.getByRole('button', { name: 'Save measurements' }));
  expect(await screen.findByText('Could not save your measurements. Try again.')).toBeTruthy();
  expect(screen.getByLabelText('Weight (kg)').props.value).toBe('75');
  jest.mocked(progressApi.measurements).mockResolvedValue({
    items: [{ ...item, id: 1, weight_kg: '74.000000' }, item],
  });
  fireEvent.press(screen.getByRole('button', { name: 'Save measurements' }));
  expect(await screen.findByText('Measurements saved.')).toBeTruthy();
  expect(progressApi.record).toHaveBeenCalledTimes(2);
  for (const [input] of jest.mocked(progressApi.record).mock.calls) {
    expect(input).toEqual({ date: recordedDate, request_id: requestId, weight_kg: '75.000000' });
  }
  const point = await screen.findByRole('button', { name: '2026-01-02, 75.00 kg' });
  fireEvent.press(point);
  expect(point.props.accessibilityState.selected).toBe(true);
  expect(screen.queryByRole('button', { name: '2026-01-02, 74.00 kg' })).toBeNull();
  expect(screen.getByText('74.00 kg')).toBeTruthy();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: measurementKey(1) });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['accounts', 1, 'me'], exact: true });
  fireEvent.press(screen.getByRole('tab', { name: 'Waist' }));
  expect(screen.getByText('No waist measurements yet.')).toBeTruthy();
});

test('saves the selected objective target and refetches if the objective changes under an edit', async () => {
  const targetDate = shiftCalendarMonth(todayForProfile(completeAccount.profile.timezone), 1);
  const target = {
    objective: 'gain_weight' as const,
    target: { weight_kg: '80.000000', target_date: targetDate },
  };
  jest
    .mocked(progressApi.saveTarget)
    .mockResolvedValueOnce(target)
    .mockRejectedValueOnce(new ApiError(409));
  open();
  fireEvent.press(await screen.findByRole('button', { name: 'Set target' }));
  fireEvent.changeText(screen.getByLabelText('Target weight (kg)'), '80');
  fireEvent.press(screen.getByRole('button', { name: 'Target date' }));
  expect(screen.getByRole('header', { name: 'Target date' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Save target' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
  fireEvent.press(screen.getByRole('button', { name: `Select ${calendarLabel(targetDate)}` }));
  fireEvent.press(screen.getByRole('button', { name: 'Save target' }));
  expect(await screen.findByText('Weight target saved.')).toBeTruthy();
  expect(screen.getByText('80.00 kg')).toBeTruthy();
  expect(screen.getByText(`Target date · ${displayProgressDate(targetDate)}`)).toBeTruthy();
  expect(jest.mocked(progressApi.saveTarget).mock.calls[0][0]).toEqual({
    ...target.target,
    objective: 'gain_weight',
  });

  fireEvent.press(screen.getByRole('button', { name: 'Edit target' }));
  expect(screen.getByLabelText('Target weight (kg)').props.value).toBe('80.00');
  fireEvent.press(screen.getByRole('button', { name: 'Save target' }));
  expect(
    await screen.findByText('Your objective changed. Close this form to load the current target.'),
  ).toBeTruthy();
  jest.mocked(progressApi.target).mockResolvedValue({ objective: 'maintain_weight', target: null });
  fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.getByText('Maintain weight')).toBeTruthy());
  expect(screen.queryByText('80.00 kg')).toBeNull();
});

test('opens the log with latest stored values and lets users clear a previous value', async () => {
  jest.mocked(progressApi.measurements).mockResolvedValue({
    items: [
      { ...item, id: 1, weight_kg: '74.123456', arm_cm: '29.55' },
      { ...item, id: 2, weight_kg: '75.123456' },
    ],
  });
  jest.mocked(progressApi.record).mockResolvedValue(item);
  open();
  await screen.findByRole('button', { name: '2026-01-02, 75.12 kg' });
  fireEvent.press(screen.getByRole('button', { name: 'Log measurements' }));
  expect(screen.getByLabelText('Weight (kg)').props.value).toBe('75.12');
  expect(screen.getByLabelText('Arm (cm)').props.value).toBe('29.55');
  fireEvent.changeText(screen.getByLabelText('Arm (cm)'), '');
  fireEvent.press(screen.getByRole('button', { name: 'Save measurements' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Measurements saved.');
  expect(jest.mocked(progressApi.record).mock.calls[0][0]).toEqual({
    request_id: requestId,
    date: todayForProfile(completeAccount.profile.timezone),
    weight_kg: '75.123456',
  });
  fireEvent.press(screen.getByRole('button', { name: 'Dismiss notification' }));
  expect(screen.queryByText('Measurements saved.')).toBeNull();
});
