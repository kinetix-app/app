import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LeaguePictureEditor, type LeaguePictureDraft } from '../components/LeaguePictureEditor';
import { pickLeaguePicture } from '../components/leaguePicture';

jest.mock('../components/leaguePicture', () => ({ pickLeaguePicture: jest.fn() }));
jest.mock('../components/LeagueAvatar', () => ({ LeagueAvatar: () => null }));

function PictureField() {
  const [draft, setDraft] = useState<LeaguePictureDraft>();
  return (
    <LeaguePictureEditor
      accountId={1}
      name="Early birds"
      draft={draft}
      onChange={setDraft}
      onBusy={() => {}}
    />
  );
}

afterEach(() => jest.clearAllMocks());

test('selection and removal stage a picture without separate save actions', async () => {
  jest
    .mocked(pickLeaguePicture)
    .mockResolvedValue({ asset: { uri: 'file:///picture.png', width: 64, height: 64 } });
  render(<PictureField />);
  fireEvent.press(screen.getByRole('button', { name: 'Choose league picture' }));
  expect(await screen.findByRole('button', { name: 'Replace league picture' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Save picture' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Remove league picture' }));
  expect(screen.getByRole('button', { name: 'Choose league picture' })).toBeTruthy();
});
