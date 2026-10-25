import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ObjectiveEditor, objectiveOptions } from '../components/ObjectiveEditor';
import { getAccount, getObjective, setObjective } from '../api';
import { completeAccount } from './fixtures';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('../api', () => ({
  getAccount: jest.fn(),
  getObjective: jest.fn(),
  setObjective: jest.fn(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getObjective).mockResolvedValue({ objective: null });
  jest.mocked(getAccount).mockResolvedValue(completeAccount);
});
function mount(onSaved = jest.fn()) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ObjectiveEditor accountId={1} onSaved={onSaved} />
    </QueryClientProvider>,
  );
}
test.each(objectiveOptions)(
  '$label is an explicit, distinct objective',
  async ({ value, label }) => {
    jest.mocked(setObjective).mockResolvedValue({ objective: value });
    const saved = jest.fn();
    mount(saved);
    await screen.findByRole('radio', { name: label });
    expect(
      screen.getByRole('button', { name: 'Save objective' }).props.accessibilityState.disabled,
    ).toBe(true);
    fireEvent.press(screen.getByRole('radio', { name: label }));
    fireEvent.press(screen.getByText('Save objective'));
    await waitFor(() => expect(saved).toHaveBeenCalledWith(completeAccount));
    expect(setObjective).toHaveBeenCalledTimes(1);
    expect(setObjective).toHaveBeenCalledWith(value);
  },
);

test('an objective save failure keeps its selection and retries only on explicit action', async () => {
  jest
    .mocked(setObjective)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ objective: 'lose_fat' });
  const saved = jest.fn();
  mount(saved);
  await screen.findByRole('radio', { name: 'Lose fat' });
  fireEvent.press(screen.getByRole('radio', { name: 'Lose fat' }));
  fireEvent.press(screen.getByText('Save objective'));
  await screen.findByText(
    'Could not finish saving your objective. Your selection is kept. Try again.',
  );
  expect(screen.getByRole('radio', { name: 'Lose fat' }).props.accessibilityState.checked).toBe(
    true,
  );
  expect(setObjective).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByText('Save objective'));
  await waitFor(() => expect(saved).toHaveBeenCalledWith(completeAccount));
  expect(setObjective).toHaveBeenCalledTimes(2);
});
