import { apiClient } from '@/services/apiClient';
import { friendsApi, friendsKey, requestsKey } from '@/features/friends/api';
import { feedApi } from '../api';

jest.mock('@/services/apiClient', () => ({
  ...jest.requireActual('@/services/apiClient'),
  apiClient: {
    get: jest.fn(),
    getBlob: jest.fn(),
    post: jest.fn(),
    postMultipart: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const signal = new AbortController().signal;
const anything = expect.anything();

beforeEach(() => jest.clearAllMocks());

test('feed calls use the posts routes with cursors and the friends scope', () => {
  void feedApi.posts(null, signal);
  void feedApi.posts(42, signal, 'everyone');
  void feedApi.workout(5, signal);
  void feedApi.comments(5, null);
  void feedApi.comments(5, 9);
  expect(jest.mocked(apiClient.get).mock.calls.map(([path]) => path)).toEqual([
    '/api/v1/posts?limit=10&scope=friends',
    '/api/v1/posts?limit=10&scope=everyone&before_id=42',
    '/api/v1/posts/5/workout',
    '/api/v1/posts/5/comments?limit=30',
    '/api/v1/posts/5/comments?limit=30&after_id=9',
  ]);
});

test('feed writes send the expected requests', () => {
  void feedApi.create({ trainingSessionId: null, text: 'Hi', visibility: 'FRIENDS', photos: [] });
  expect(apiClient.postMultipart).toHaveBeenCalledWith(
    '/api/v1/posts',
    expect.any(FormData),
    anything,
  );
  void feedApi.like(3, true);
  expect(apiClient.put).toHaveBeenCalledWith('/api/v1/posts/3/like', undefined, anything);
  void feedApi.like(3, false);
  expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/posts/3/like', anything);
  void feedApi.remove(3);
  expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/posts/3');
  void feedApi.addComment(3, '  Nice  ');
  expect(apiClient.post).toHaveBeenCalledWith(
    '/api/v1/posts/3/comments',
    { comment: 'Nice' },
    anything,
  );
  void feedApi.removeComment(3, 8);
  expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/posts/3/comments/8');
});

test('post media only requests authenticated media paths', () => {
  void feedApi.media('/api/v1/posts/1/media/2', signal);
  expect(apiClient.getBlob).toHaveBeenCalledWith('/api/v1/posts/1/media/2', { signal });
  expect(() => feedApi.media('https://evil.example/x.jpg')).toThrow();
});

test('friends calls use the people and friends routes', () => {
  void friendsApi.friends(50, signal);
  void friendsApi.requests(signal);
  void friendsApi.search('  ana & bia ', signal);
  void friendsApi.person(4, signal);
  expect(jest.mocked(apiClient.get).mock.calls.map(([path]) => path)).toEqual([
    '/api/v1/friends?limit=50&offset=50',
    '/api/v1/friends/requests',
    '/api/v1/people?limit=20&q=ana%20%26%20bia',
    '/api/v1/people/4',
  ]);
  void friendsApi.picture(4, signal);
  expect(apiClient.getBlob).toHaveBeenCalledWith('/api/v1/people/4/picture', { signal });
  void friendsApi.request(4);
  expect(apiClient.post).toHaveBeenCalledWith('/api/v1/friends/requests', { user_id: 4 }, anything);
  void friendsApi.accept(4);
  expect(apiClient.post).toHaveBeenCalledWith(
    '/api/v1/friends/requests/4/accept',
    undefined,
    anything,
  );
  void friendsApi.remove(4);
  expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/friends/4');
  expect(friendsKey(1)).toEqual(['friends', 1]);
  expect(requestsKey(1)).toEqual(['friends', 1, 'requests']);
});
