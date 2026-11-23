import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { Post, PostPage } from './schemas';

export type FeedScope = 'everyone' | 'friends';
/** Prefix for every feed scope; cache edits apply to all of them. */
export const feedKey = (accountId: number) => ['feed', accountId, 'posts'] as const;
export const scopedFeedKey = (accountId: number, scope: FeedScope) =>
  [...feedKey(accountId), scope] as const;
// The training prefix also refreshes composer options after a workout finishes.
export const workoutOptionsKey = (accountId: number) =>
  ['training', accountId, 'post-workout-options'] as const;
export const commentsKey = (accountId: number, postId: number) =>
  ['feed', accountId, 'comments', postId] as const;

type Feed = InfiniteData<PostPage, number | null>;

function editFeed(cache: QueryClient, accountId: number, edit: (items: Post[]) => Post[]) {
  cache.setQueriesData<Feed>({ queryKey: feedKey(accountId) }, (data) =>
    data
      ? { ...data, pages: data.pages.map((page) => ({ ...page, items: edit(page.items) })) }
      : data,
  );
}

/** Applies a confirmed server change to the cached post; never an optimistic guess. */
export function updatePost(
  cache: QueryClient,
  accountId: number,
  postId: number,
  change: (post: Post) => Post,
) {
  editFeed(cache, accountId, (items) =>
    items.map((item) => (item.id === postId ? change(item) : item)),
  );
}

export function removePost(cache: QueryClient, accountId: number, postId: number) {
  editFeed(cache, accountId, (items) => items.filter((item) => item.id !== postId));
}

/** Own posts appear in every scope, so a new post is added to each loaded feed. */
export function prependPost(cache: QueryClient, accountId: number, post: Post) {
  cache.setQueriesData<Feed>({ queryKey: feedKey(accountId) }, (data) => {
    if (!data?.pages.length) return data;
    const [first, ...rest] = data.pages;
    return {
      ...data,
      pages: [
        { ...first, items: [post, ...first.items.filter((item) => item.id !== post.id)] },
        ...rest,
      ],
    };
  });
}
