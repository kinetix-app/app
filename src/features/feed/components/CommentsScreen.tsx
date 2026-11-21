import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import React, { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PersonAvatar } from '@/features/friends/components/PersonAvatar';
import { TextField } from '@/components/TextField';
import { Button, IconButton, Loading, ui } from '@/features/training/components/ui';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { feedApi } from '../api';
import { commentsKey, updatePost } from '../cache';
import { authorName, relativeTime } from '../format';
import { MAX_COMMENT_TEXT, type Comment, type CommentPage, type Post } from '../schemas';

type Comments = InfiniteData<CommentPage, number | null>;

export function CommentsScreen({
  accountId,
  post,
  onBack,
}: Readonly<{ accountId: number; post: Post; onBack: () => void }>) {
  const p = usePalette();
  const cache = useQueryClient();
  const key = commentsKey(accountId, post.id);
  const comments = useInfiniteQuery({
    queryKey: key,
    initialPageParam: null as number | null,
    queryFn: ({ pageParam, signal }) => feedApi.comments(post.id, pageParam, signal),
    getNextPageParam: (page) => page.next_after_id ?? undefined,
  });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<number | null>(null);
  const busy = useRef(false);
  const name = authorName(post.author.display_name);

  function changeCount(delta: number) {
    updatePost(cache, accountId, post.id, (item) => ({
      ...item,
      comment_count: Math.max(0, item.comment_count + delta),
    }));
  }

  async function send() {
    const text = draft.trim();
    if (!text || busy.current) return;
    busy.current = true;
    setSending(true);
    setError('');
    try {
      const saved = await feedApi.addComment(post.id, text);
      cache.setQueryData<Comments>(key, (data) => {
        if (!data?.pages.length) return data;
        const pages = [...data.pages];
        const last = pages.length - 1;
        // Only append when the newest page is loaded; otherwise it arrives with pagination.
        if (pages[last].next_after_id === null)
          pages[last] = { ...pages[last], items: [...pages[last].items, saved] };
        return { ...data, pages };
      });
      changeCount(1);
      setDraft('');
    } catch {
      setError('Could not post your comment. Your text is kept. Try again.');
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  async function remove(comment: Comment) {
    if (removing !== null) return;
    setRemoving(comment.id);
    setError('');
    try {
      await feedApi.removeComment(post.id, comment.id);
      cache.setQueryData<Comments>(key, (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: page.items.filter((item) => item.id !== comment.id),
              })),
            }
          : data,
      );
      changeCount(-1);
    } catch {
      setError('Could not delete the comment. Try again.');
    } finally {
      setRemoving(null);
    }
  }

  const items = comments.data?.pages.flatMap((page) => page.items) ?? [];
  let footer: React.ReactNode = null;
  if (comments.isFetchingNextPage) footer = <Loading />;
  else if (comments.isFetchNextPageError)
    footer = (
      <View style={ui.gap}>
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          Could not load more comments.
        </Text>
        <Button
          title="Retry"
          secondary
          onPress={() => void comments.fetchNextPage({ cancelRefetch: false })}
        />
      </View>
    );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[ui.screen, { backgroundColor: p['surface-100'] }]}
    >
      <KeyboardAvoidingView
        style={ui.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          contentContainerStyle={ui.content}
          keyboardShouldPersistTaps="handled"
          data={items}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={
            <View style={ui.gap}>
              <View style={ui.row}>
                <IconButton icon="arrow-left" label="Back to feed" onPress={onBack} />
                <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
                  Comments
                </Text>
              </View>
              <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                On {name}’s workout
              </Text>
              {comments.isPending ? <Loading /> : null}
              {comments.isError && !comments.data ? (
                <View style={ui.gap}>
                  <Text accessibilityRole="alert" style={{ color: p.danger }}>
                    Could not load comments.
                  </Text>
                  <Button title="Retry" secondary onPress={() => void comments.refetch()} />
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            comments.data ? (
              <Text style={{ color: p['ink-muted'] }}>
                No comments yet. Start the conversation.
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.comment}>
              <PersonAvatar accountId={accountId} person={item.author} size={36} />
              <View style={{ flex: 1, gap: spacing['space-1'] }}>
                <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                  <Text style={[textStyles.label, { color: p.ink }]}>
                    {authorName(item.author.display_name)}
                  </Text>
                  {' · '}
                  {relativeTime(item.created_at)}
                </Text>
                <Text style={[textStyles.body, { color: p.ink }]}>{item.comment}</Text>
              </View>
              {item.is_mine || post.is_mine ? (
                <IconButton
                  icon="trash-2"
                  label={`Delete comment by ${authorName(item.author.display_name)}`}
                  disabled={removing !== null}
                  onPress={() => {
                    void remove(item);
                  }}
                />
              ) : null}
            </View>
          )}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (comments.hasNextPage && !comments.isFetching && !comments.isFetchNextPageError)
              void comments.fetchNextPage({ cancelRefetch: false });
          }}
          ListFooterComponent={footer}
        />
        <View style={[styles.composer, { borderColor: p.line, backgroundColor: p['surface-200'] }]}>
          {error ? (
            <Text accessibilityRole="alert" style={{ color: p.danger }}>
              {error}
            </Text>
          ) : null}
          <View style={ui.row}>
            <TextField
              accessibilityLabel="Write a comment"
              placeholder="Write a comment"
              value={draft}
              onChangeText={setDraft}
              maxLength={MAX_COMMENT_TEXT}
              multiline
              editable={!sending}
              containerStyle={{ flex: 1 }}
            />
            <Button
              title={sending ? 'Sending…' : 'Send'}
              tone="positive"
              disabled={sending || !draft.trim()}
              onPress={() => {
                void send();
              }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['space-3'] },
  composer: {
    borderTopWidth: 1,
    padding: spacing['space-3'],
    gap: spacing['space-2'],
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
});
