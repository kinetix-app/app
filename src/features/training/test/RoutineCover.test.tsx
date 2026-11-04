import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { RoutineCover } from '../components/RoutineCover';
import { trainingApi } from '../api';

jest.mock('../api', () => ({ trainingApi: { picture: jest.fn() } }));
const blob = new Blob(['picture'], { type: 'image/png' });
const readers: Reader[] = [];
class Reader {
  static LOADING = 1;
  readyState = 1;
  result: string | ArrayBuffer | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  abort = jest.fn();
  readAsDataURL = jest.fn();
  constructor() {
    readers.push(this);
  }
}
const originalReader = globalThis.FileReader;
beforeEach(() => {
  jest.clearAllMocks();
  readers.length = 0;
  globalThis.FileReader = Reader as unknown as typeof FileReader;
});
afterEach(() => {
  globalThis.FileReader = originalReader;
});
function show(props: Partial<React.ComponentProps<typeof RoutineCover>> = {}) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RoutineCover accountId={1} routineId={10} {...props} />
    </QueryClientProvider>,
  );
}

test('local preview opens the editor without fetching a private cover', () => {
  const onOpen = jest.fn();
  show({ path: '/picture', preview: 'file:///local.jpg', onOpen, openLabel: 'Edit cover' });
  expect(screen.getByLabelText('Routine cover').props.source.uri).toBe('file:///local.jpg');
  fireEvent.press(screen.getByRole('button', { name: 'Edit cover' }));
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(trainingApi.picture).not.toHaveBeenCalled();
});

test('download failure offers retry and displays the decoded authenticated blob', async () => {
  jest
    .mocked(trainingApi.picture)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(blob);
  show({ path: '/picture' });
  fireEvent.press(await screen.findByRole('button', { name: 'Retry routine cover' }));
  await waitFor(() => expect(readers).toHaveLength(1));
  expect(readers[0].readAsDataURL).toHaveBeenCalledWith(blob);
  await act(async () => {
    readers[0].result = 'data:image/png;base64,cGljdHVyZQ==';
    readers[0].readyState = 2;
    readers[0].onload?.();
  });
  expect(screen.getByLabelText('Routine cover').props.source.uri).toBe(
    'data:image/png;base64,cGljdHVyZQ==',
  );
  expect(screen.queryByLabelText('Retry routine cover')).toBeNull();
  fireEvent(screen.getByLabelText('Routine cover'), 'error');
  expect(screen.getByRole('button', { name: 'Retry routine cover' })).toBeTruthy();
});

test('decode errors expose recovery and pending reads are aborted on unmount', async () => {
  jest.mocked(trainingApi.picture).mockResolvedValue(blob);
  const view = show({ path: '/picture' });
  await waitFor(() => expect(readers).toHaveLength(1));
  await act(async () => {
    readers[0].onerror?.();
  });
  expect(screen.getByRole('button', { name: 'Retry routine cover' })).toBeTruthy();
  view.unmount();
  expect(readers[0].abort).toHaveBeenCalledTimes(1);
  expect(readers[0].onload).toBeNull();
  expect(readers[0].onerror).toBeNull();
});

test('switching accounts never reuses another account’s decoded cover', async () => {
  jest.mocked(trainingApi.picture).mockResolvedValue(blob);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const cover = (accountId: number) => (
    <QueryClientProvider client={client}>
      <RoutineCover accountId={accountId} routineId={10} path="/picture" />
    </QueryClientProvider>
  );
  const view = render(cover(1));
  await waitFor(() => expect(readers).toHaveLength(1));
  await act(async () => {
    readers[0].result = 'data:image/png;base64,YWxpY2U=';
    readers[0].readyState = 2;
    readers[0].onload?.();
  });
  expect(screen.getByLabelText('Routine cover')).toBeTruthy();
  jest.mocked(trainingApi.picture).mockImplementationOnce(() => new Promise(() => {}));
  view.rerender(cover(2));
  expect(screen.queryByLabelText('Routine cover')).toBeNull();
  expect(screen.getByLabelText('Loading routine cover')).toBeTruthy();
  expect(trainingApi.picture).toHaveBeenCalledTimes(2);
});
