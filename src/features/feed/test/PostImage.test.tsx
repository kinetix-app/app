import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { feedApi } from '../api';
import { PostImage } from '../components/PostImage';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));

jest.mock('../api', () => ({ feedApi: { media: jest.fn() } }));

const path = '/api/v1/posts/1/media/2';

let client: QueryClient;

function show() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <PostImage accountId={1} path={path} label="Photo 1 of 1 by Bob" />
    </QueryClientProvider>,
  );
}

const originalReader = globalThis.FileReader;
class TestReader {
  result = 'data:image/png;base64,cG5n';
  readyState = 2;
  onload?: () => void;
  readAsDataURL() {
    this.onload?.();
  }
}
beforeAll(() => {
  globalThis.FileReader = TestReader as unknown as typeof FileReader;
});
afterAll(() => {
  globalThis.FileReader = originalReader;
});
beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  cleanup();
  client.clear();
});

test('a post photo loads with authentication and shows as a data URI', async () => {
  jest.mocked(feedApi.media).mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
  show();
  expect(screen.getByLabelText('Loading Photo 1 of 1 by Bob')).toBeTruthy();
  const image = await screen.findByLabelText('Photo 1 of 1 by Bob');
  expect(image.props.source.uri).toMatch(/^data:image\/png;base64,/);
  expect(feedApi.media).toHaveBeenCalledWith(path, expect.any(AbortSignal));
});

test('a failed photo can be retried', async () => {
  jest
    .mocked(feedApi.media)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(new Blob(['png'], { type: 'image/png' }));
  show();
  fireEvent.press(await screen.findByRole('button', { name: 'Retry loading Photo 1 of 1 by Bob' }));
  expect(await screen.findByLabelText('Photo 1 of 1 by Bob')).toBeTruthy();
  expect(feedApi.media).toHaveBeenCalledTimes(2);
});

test('tapping a thumbnail opens the same photo uncropped without fetching it again', async () => {
  jest.mocked(feedApi.media).mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
  show();
  const thumbnail = await screen.findByRole('button', { name: 'View Photo 1 of 1 by Bob' });
  fireEvent.press(thumbnail);
  const photo = screen.getByLabelText('Enlarged Photo 1 of 1 by Bob');
  expect(photo.props.resizeMode).toBe('contain');
  expect(photo.props.source.uri).toMatch(/^data:image\/png;base64,/);
  expect(feedApi.media).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'Close photo' }));
  expect(screen.queryByLabelText('Enlarged Photo 1 of 1 by Bob')).toBeNull();
});
