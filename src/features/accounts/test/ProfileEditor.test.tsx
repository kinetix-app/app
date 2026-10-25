import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ProfileEditor } from '../components/ProfileEditor';
import { updateProfile } from '../api';
import { completeAccount, incompleteAccount } from './fixtures';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('../api', () => ({ updateProfile: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
function show(account = completeAccount, onSaved = jest.fn()) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProfileEditor account={account} onSaved={onSaved} />
    </QueryClientProvider>,
  );
  return onSaved;
}
function next() {
  fireEvent.press(screen.getByText('Continue'));
}
function review() {
  next();
  next();
  next();
}

test('step validation requires explicit units and back retains values', async () => {
  show(incompleteAccount);
  next();
  expect(screen.getByText('Enter your name.')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Name'), 'Updated name');
  next();
  expect(screen.queryByLabelText('Name')).toBeNull();
  next();
  expect(screen.getByText('Enter an age from 1 to 120.')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Age (years)'), '25');
  next();
  fireEvent.changeText(screen.getByLabelText('Weight'), '70');
  fireEvent.changeText(screen.getByLabelText('Height (cm)'), '170');
  next();
  expect(screen.getByText('Choose kg or lb.')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Back'));
  expect(screen.getByLabelText('Age (years)').props.value).toBe('25');
  fireEvent.press(screen.getByLabelText('Back'));
  expect(screen.getByLabelText('Name').props.value).toBe('Updated name');
  expect(updateProfile).not.toHaveBeenCalled();
});

test('failed save retains entries and retry omits picture field', async () => {
  jest
    .mocked(updateProfile)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(completeAccount);
  const onSaved = show();
  fireEvent.changeText(screen.getByLabelText('Name'), 'Updated name');
  next();
  next();
  fireEvent.press(screen.getByRole('radio', { name: 'lb' }));
  fireEvent.changeText(screen.getByLabelText('Weight'), '100');
  next();
  fireEvent.press(screen.getByText('Save profile'));
  await screen.findByText('Could not save your profile. Your entries are kept. Try again.');
  const patch = jest.mocked(updateProfile).mock.calls[0][1];
  expect(patch).toMatchObject({
    display_name: 'Updated name',
    weight_kg: '45.359237',
    weight_unit: 'lb',
  });
  expect(patch).not.toHaveProperty('picture_url');
  fireEvent.press(screen.getByText('Save profile'));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(completeAccount));
});

test('pending profile save prevents duplicates and preserves persisted precision', async () => {
  let resolve: (account: typeof completeAccount) => void = () => {};
  jest.mocked(updateProfile).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const onSaved = show({
    ...completeAccount,
    profile: { ...completeAccount.profile, weight_kg: '45.359237', weight_unit: 'lb' },
  });
  review();
  fireEvent.press(screen.getByText('Save profile'));
  await screen.findByText('Saving…');
  fireEvent.press(screen.getByText('Saving…'));
  expect(updateProfile).toHaveBeenCalledTimes(1);
  expect(jest.mocked(updateProfile).mock.calls[0][1]).toMatchObject({ weight_kg: '45.359237' });
  await act(async () => resolve(completeAccount));
  expect(onSaved).toHaveBeenCalledTimes(1);
});

test('unit preference converts displayed body mass', () => {
  show();
  next();
  next();
  fireEvent.press(screen.getByRole('radio', { name: 'lb' }));
  expect(screen.getByLabelText('Weight').props.value).toBe('154.323584');
  fireEvent.press(screen.getByRole('radio', { name: 'kg' }));
  expect(screen.getByLabelText('Weight').props.value).toBe('70.000000');
});
