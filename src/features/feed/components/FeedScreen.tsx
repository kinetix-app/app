import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button, IconButton, Loading, ui } from '@/features/training/components/ui';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { ApiError } from '@/services/apiClient';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { PersonScreen } from '@/features/friends';
import { feedApi } from '../api';
import { prependPost, removePost, scopedFeedKey, updatePost, workoutOptionsKey } from '../cache';
import type { Post } from '../schemas';
import { PostOptions, type WorkoutActions } from './PostOptions';
import { CommentsScreen } from './CommentsScreen';
import { PostCard } from './PostCard';
import { ShareWorkoutScreen } from './ShareWorkoutScreen';
import { SharedWorkoutDetail } from './SharedWorkoutDetail';

type Panel =
  | { kind: 'feed' }
  | { kind: 'comments'; post: Post }
  | { kind: 'workout'; post: Post }
  | { kind: 'share'; sessionId?: number | null }
  | { kind: 'person'; id: number; name: string | null };

type FeedScreenProps = Readonly<{
  accountId: number;
  active?: boolean;
  /** Header control supplied by the shell, e.g. the profile avatar button. */
  profileButton?: React.ReactNode;
  /** Opens the new-post screen with this completed workout selected (e.g. from history). */
  composeSessionId?: number | null;
  onComposeClosed?: () => void;
  onComposerOpenChange?: (open: boolean) => void;
  /** Opens the shell's friends screen. */
  onFindFriends?: () => void;
  workoutActions?: WorkoutActions;
}>;

export function FeedScreen({
  accountId,
  active = true,
  profileButton,
  composeSessionId = null,
  onComposeClosed,
  onComposerOpenChange,
  onFindFriends,
  workoutActions,
}: FeedScreenProps) {
  const p = usePalette();
  const cache = useQueryClient();
  const [panel, setPanel] = useState<Panel>({ kind: 'feed' });
  const [liking, setLiking] = useState<ReadonlySet<number>>(new Set());
  const [likeErrors, setLikeErrors] = useState<ReadonlySet<number>>(new Set());
  const [options, setOptions] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState<Post | null>(null);
  // The feed shows only the person's own posts and their friends' posts.
  const feed = useInfiniteQuery({
    queryKey: scopedFeedKey(accountId, 'friends'),
    initialPageParam: null as number | null,
    queryFn: ({ pageParam, signal }) => feedApi.posts(pageParam, signal, 'friends'),
    getNextPageParam: (page) => page.next_before_id ?? undefined,
  });
  // A share request from the shell takes over until the composer closes.
  const view: Panel =
    composeSessionId !== null ? { kind: 'share', sessionId: composeSessionId } : panel;
  const isComposing = view.kind === 'share';
  useEffect(() => {
    onComposerOpenChange?.(isComposing);
  }, [isComposing, onComposerOpenChange]);
  const closePanel = useCallback(() => {
    setPanel({ kind: 'feed' });
    onComposeClosed?.();
  }, [onComposeClosed]);
  const onBack = useCallback(() => {
    closePanel();
    return true;
  }, [closePanel]);
  useHardwareBack(onBack, active && view.kind !== 'feed' && view.kind !== 'share' && !deleting);

  async function toggleLike(post: Post) {
    if (liking.has(post.id)) return;
    setLiking((current) => new Set(current).add(post.id));
    setLikeErrors((current) => without(current, post.id));
    try {
      const result = await feedApi.like(post.id, !post.liked_by_me);
      updatePost(cache, accountId, post.id, (item) => ({
        ...item,
        liked_by_me: result.liked,
        like_count: result.like_count,
      }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) removePost(cache, accountId, post.id);
      else setLikeErrors((current) => new Set(current).add(post.id));
    } finally {
      setLiking((current) => without(current, post.id));
    }
  }

  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];
  let footer: React.ReactNode = null;
  if (feed.isFetchingNextPage) footer = <Loading />;
  else if (feed.isFetchNextPageError)
    footer = (
      <View style={ui.gap}>
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          Could not load more posts. Your feed is kept.
        </Text>
        <Button
          title="Retry"
          secondary
          onPress={() => void feed.fetchNextPage({ cancelRefetch: false })}
        />
      </View>
    );

  const header = (
    <View style={ui.gap}>
      <ScreenHeader title="Feed">
        <View style={ui.row}>
          <IconButton
            icon={<Ionicons name="create-outline" size={24} color={p.ink} />}
            label="New post"
            bare
            onPress={() => setPanel({ kind: 'share' })}
          />
          {profileButton}
        </View>
      </ScreenHeader>
      {feed.isPending ? <Loading /> : null}
      {feed.isError && !feed.data ? (
        <View style={ui.gap}>
          <Text accessibilityRole="alert" style={{ color: p.danger }}>
            {feedErrorMessage(feed.error)}
          </Text>
          <Button title="Retry" secondary onPress={() => void feed.refetch()} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={ui.screen}>
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[
          ui.screen,
          { backgroundColor: p['surface-100'], display: view.kind === 'feed' ? 'flex' : 'none' },
        ]}
        aria-hidden={view.kind !== 'feed' || Boolean(options || deleting)}
        accessibilityElementsHidden={view.kind !== 'feed' || Boolean(options || deleting)}
        importantForAccessibility={
          view.kind !== 'feed' || options || deleting ? 'no-hide-descendants' : 'auto'
        }
      >
        <FlatList
          contentContainerStyle={[ui.content, { paddingTop: spacing['space-8'] }]}
          data={items}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={header}
          ListEmptyComponent={
            (feed.data ? (
              <View style={[ui.card, styles.empty, { backgroundColor: p['surface-200'] }]}>
                <Text style={[textStyles['title-md'], { color: p.ink }]}>No posts yet</Text>
                <Text style={[textStyles.body, { color: p['ink-muted'], textAlign: 'center' }]}>
                  Your feed shows posts from you and your friends. Add friends or share something to
                  get started.
                </Text>
                <Button
                  title="Find friends"
                  tone="positive"
                  icon="user-plus"
                  onPress={() => onFindFriends?.()}
                />
                <Button
                  title="Create a post"
                  secondary
                  icon="plus"
                  onPress={() => setPanel({ kind: 'share' })}
                />
              </View>
            ) : null) ?? undefined
          }
          renderItem={({ item }) => (
            <PostCard
              accountId={accountId}
              post={item}
              likePending={liking.has(item.id)}
              likeError={likeErrors.has(item.id)}
              onLike={(post) => {
                void toggleLike(post);
              }}
              onComments={(post) => setPanel({ kind: 'comments', post })}
              onWorkout={(post) => setPanel({ kind: 'workout', post })}
              onOptions={setOptions}
              onAuthor={(post) =>
                setPanel({ kind: 'person', id: post.author.id, name: post.author.display_name })
              }
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching && !feed.isFetchingNextPage}
              onRefresh={() => void feed.refetch()}
              tintColor={p.brand}
              colors={[p.brand]}
            />
          }
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetching && !feed.isFetchNextPageError)
              void feed.fetchNextPage({ cancelRefetch: false });
          }}
          ListFooterComponent={footer ?? undefined}
        />
      </SafeAreaView>
      {view.kind === 'person' ? (
        <PersonScreen
          accountId={accountId}
          personId={view.id}
          fallbackName={view.name}
          onBack={closePanel}
          backLabel="Back to feed"
        />
      ) : null}
      {view.kind === 'comments' ? (
        <CommentsScreen accountId={accountId} postId={view.post.id} onBack={closePanel} />
      ) : null}
      {view.kind === 'workout' ? (
        <SharedWorkoutDetail accountId={accountId} post={view.post} onBack={closePanel} />
      ) : null}
      {view.kind === 'share' ? (
        <ShareWorkoutScreen
          key={`share-${view.sessionId ?? 'new'}`}
          accountId={accountId}
          initialSessionId={view.sessionId}
          active={active}
          onClose={closePanel}
          onShared={(post) => {
            prependPost(cache, accountId, post);
            if (post.workout)
              void cache.invalidateQueries({ queryKey: workoutOptionsKey(accountId) });
            if (!feed.data) void feed.refetch();
            closePanel();
          }}
        />
      ) : null}
      {options ? (
        <PostOptions
          key={options.id}
          post={options}
          workoutActions={workoutActions}
          onClose={() => setOptions(null)}
          onDelete={(post) => {
            setOptions(null);
            setDeleting(post);
          }}
        />
      ) : null}
      <DeleteConfirmation
        post={deleting}
        onCancel={() => setDeleting(null)}
        onDeleted={(post) => {
          removePost(cache, accountId, post.id);
          if (post.workout)
            void cache.invalidateQueries({ queryKey: workoutOptionsKey(accountId) });
          setDeleting(null);
        }}
      />
    </View>
  );
}

function DeleteConfirmation({
  post,
  onCancel,
  onDeleted,
}: Readonly<{ post: Post | null; onCancel: () => void; onDeleted: (post: Post) => void }>) {
  const p = usePalette();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  function cancel() {
    if (pending) return;
    setError('');
    onCancel();
  }
  async function confirm() {
    if (!post || pending) return;
    setPending(true);
    setError('');
    try {
      await feedApi.remove(post.id);
      onDeleted(post);
    } catch (error_) {
      if (error_ instanceof ApiError && error_.status === 404) onDeleted(post);
      else setError('Could not delete the post. Try again.');
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal visible={post !== null} transparent animationType="fade" onRequestClose={cancel}>
      <View style={[styles.scrim, { backgroundColor: p.scrim }]}>
        <View
          accessibilityViewIsModal
          style={[ui.card, { backgroundColor: p['surface-200'], width: '100%', maxWidth: 420 }]}
        >
          <Text accessibilityRole="alert" style={[ui.heading, { color: p.ink }]}>
            Delete this post?
          </Text>
          <Text style={{ color: p['ink-muted'] }}>
            Its photos, likes and comments are removed. The workout stays in your history.
          </Text>
          {error ? (
            <Text accessibilityRole="alert" style={{ color: p.danger }}>
              {error}
            </Text>
          ) : null}
          <Button title="Cancel" secondary disabled={pending} onPress={cancel} />
          <Button
            title={pending ? 'Deleting…' : 'Delete'}
            tone="danger"
            disabled={pending}
            onPress={() => {
              void confirm();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

function without(values: ReadonlySet<number>, value: number) {
  const next = new Set(values);
  next.delete(value);
  return next;
}

function feedErrorMessage(error: unknown) {
  if (error instanceof ApiError && [401, 403].includes(error.status))
    return 'Your account cannot load the feed. Sign out and sign in again.';
  return 'Could not load your feed. Check your connection and try again.';
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: spacing['space-8'] },
  scrim: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing['space-6'] },
});
