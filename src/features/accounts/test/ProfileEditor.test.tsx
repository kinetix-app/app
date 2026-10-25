import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ProfileEditor } from '../components/ProfileEditor';
import { updateProfile } from '../api';
import { completeAccount } from './fixtures';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('../api', () => ({ updateProfile: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

test('failed profile save retains input, clears picture explicitly, and can be retried', async () => {
  jest
    .mocked(updateProfile)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(completeAccount);
  const onSaved = jest.fn();
  render(<ProfileEditor account={completeAccount} onSaved={onSaved} />);
  fireEvent.changeText(screen.getByLabelText('Name'), 'Updated name');
  fireEvent.press(screen.getByRole('radio', { name: 'lb' }));
  fireEvent.changeText(screen.getByLabelText('Weight'), '100');
  fireEvent.press(screen.getByText('Save profile'));
  await screen.findByText('Could not save your profile. Your entries are kept. Try again.');
  expect(screen.getByLabelText('Name').props.value).toBe('Updated name');
  expect(updateProfile).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      display_name: 'Updated name',
      weight_kg: '45.359237',
      weight_unit: 'lb',
      picture_url: null,
    }),
  );
  fireEvent.press(screen.getByText('Save profile'));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(completeAccount));
  expect(updateProfile).toHaveBeenCalledTimes(2);
});

test('pending profile save prevents duplicate submissions and preserves persisted precision', async () => {
  let resolve: (account: typeof completeAccount) => void = () => {};
  jest.mocked(updateProfile).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const onSaved = jest.fn();
  render(
    <ProfileEditor
      account={{
        ...completeAccount,
        profile: { ...completeAccount.profile, weight_kg: '45.359237', weight_unit: 'lb' },
      }}
      onSaved={onSaved}
    />,
  );
  fireEvent.press(screen.getByText('Save profile'));
  await screen.findByText('Saving…');
  fireEvent.press(screen.getByText('Saving…'));
  expect(updateProfile).toHaveBeenCalledTimes(1);
  expect(updateProfile).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ weight_kg: '45.359237' }),
  );
  await act(async () => resolve(completeAccount));
  expect(onSaved).toHaveBeenCalledTimes(1);
});

test('changing unit preference converts the displayed body mass', () => {
  render(<ProfileEditor account={completeAccount} onSaved={jest.fn()} />);
  fireEvent.press(screen.getByRole('radio', { name: 'lb' }));
  expect(screen.getByLabelText('Weight').props.value).toBe('154.323584');
  expect(screen.getByText('Weight (lb)')).toBeTruthy();
  fireEvent.press(screen.getByRole('radio', { name: 'kg' }));
  expect(screen.getByLabelText('Weight').props.value).toBe('70.000000');
});
