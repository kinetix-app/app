import { useLanguage } from '@/i18n/Language';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PersonAvatar } from '@/features/friends/components/PersonAvatar';
import { TextField } from '@/components/TextField';
import { Button, IconButton, Loading, ui } from '@/features/training/components/ui';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { ApiError } from '@/services/apiClient';
import { PostCard } from './PostCard';
import { feedApi } from '../api';
import { commentsKey, removePost, updatePost } from '../cache';
import { authorName, relativeTime } from '../format';
import { MAX_COMMENT_TEXT, type Comment, type CommentPage, type Post } from '../schemas';

type Comments = InfiniteData<CommentPage, number | null>;

async function submitComment({
  text,
  postId,
  key,
  cache,
  busy,
  setSending,
  setError,
  setDraft,
  onUnavailable,
  language,
  onCountChange,
}: Readonly<{
  text: string;
  postId: number;
  key: ReturnType<typeof commentsKey>;
  cache: QueryClient;
  busy: React.MutableRefObject<boolean>;
  setSending: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setDraft: React.Dispatch<React.SetStateAction<string>>;
  onUnavailable: () => void;
  language: 'en' | 'es';
  onCountChange: () => void;
}>) {
  const trimmed = text.trim();
  if (!trimmed || busy.current) return;
  busy.current = true;
  setSending(true);
  setError('');
  try {
    const saved = await feedApi.addComment(postId, trimmed);
    cache.setQueryData<Comments>(key, (data) => {
      if (!data?.pages.length) return data;
      const pages = [...data.pages];
      const last = pages.length - 1;
      if (pages[last].next_after_id === null)
        pages[last] = { ...pages[last], items: [...pages[last].items, saved] };
      return { ...data, pages };
    });
    onCountChange();
    setDraft('');
  } catch (error) {
    if (postMissing(error)) onUnavailable();
    else
      setError(
        language === 'es'
          ? 'No se pudo publicar tu comentario. El texto se conserva. Inténtalo de nuevo.'
          : 'Could not post your comment. Your text is kept. Try again.',
      );
  } finally {
    busy.current = false;
    setSending(false);
  }
}

async function deleteComment({
  comment,
  postId,
  key,
  cache,
  removing,
  setRemoving,
  setError,
  onUnavailable,
  refetch,
  language,
  onCountChange,
}: Readonly<{
  comment: Comment;
  postId: number;
  key: ReturnType<typeof commentsKey>;
  cache: QueryClient;
  removing: number | null;
  setRemoving: React.Dispatch<React.SetStateAction<number | null>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  onUnavailable: () => void;
  refetch: () => unknown;
  language: 'en' | 'es';
  onCountChange: () => void;
}>) {
  if (removing !== null) return;
  setRemoving(comment.id);
  setError('');
  try {
    await feedApi.removeComment(postId, comment.id);
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
    onCountChange();
  } catch (error) {
    if (postMissing(error)) void refetch();
    else
      setError(
        language === 'es'
          ? 'No se pudo eliminar el comentario. Inténtalo de nuevo.'
          : 'Could not delete the comment. Try again.',
      );
  } finally {
    setRemoving(null);
  }
}

function postMissing(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

function PostCommentsContent({
  accountId,
  gone,
  pending,
  error,
  post,
  onUnavailable,
  onRetry,
}: Readonly<{
  accountId: number;
  gone: boolean;
  pending: boolean;
  error: boolean;
  post?: Post;
  onUnavailable: () => void;
  onRetry: () => void;
}>) {
  const language = useLanguage();
  const p = usePalette();
  if (gone)
    return (
      <Text accessibilityRole="alert" style={[ui.content, { color: p.ink }]}>
        {language === 'es'
          ? 'Esta publicación ya no está disponible.'
          : 'This post is no longer available.'}
      </Text>
    );
  if (pending) return <Loading />;
  if (error)
    return (
      <View style={ui.content}>
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          {language === 'es' ? 'No se pudo cargar esta publicación.' : 'Could not load this post.'}
        </Text>
        <Button title={language === 'es' ? 'Reintentar' : 'Retry'} secondary onPress={onRetry} />
      </View>
    );
  if (!post) return null;
  return <PostComments accountId={accountId} post={post} onUnavailable={onUnavailable} />;
}

export function CommentsScreen({
  accountId,
  postId,
  onBack,
}: Readonly<{ accountId: number; postId: number; onBack: () => void }>) {
  const language = useLanguage();
  const p = usePalette();
  const cache = useQueryClient();
  const post = useQuery({
    queryKey: ['feed', accountId, 'post', postId],
    queryFn: ({ signal }) => feedApi.post(postId, signal),
    gcTime: 0,
    retry: (attempt, error) => !postMissing(error) && attempt < 1,
  });
  const [unavailable, setUnavailable] = useState(false);
  const markUnavailable = useCallback(() => setUnavailable(true), []);
  const gone = unavailable || postMissing(post.error);

  useEffect(() => {
    if (gone) removePost(cache, accountId, postId);
  }, [gone, cache, accountId, postId]);

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[ui.screen, { backgroundColor: p['surface-100'] }]}
    >
      <View style={[ui.row, styles.header]}>
        <IconButton
          icon="arrow-left"
          label={language === 'es' ? 'Volver al feed' : 'Back to feed'}
          onPress={onBack}
        />
        <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
          {language === 'es' ? 'Comentarios' : 'Comments'}
        </Text>
      </View>
      <PostCommentsContent
        accountId={accountId}
        gone={gone}
        pending={post.isPending}
        error={post.isError}
        post={post.data}
        onUnavailable={markUnavailable}
        onRetry={() => void post.refetch()}
      />
    </SafeAreaView>
  );
}

function CommentsList({
  accountId,
  post,
  items,
  pending,
  error,
  hasData,
  hasNextPage,
  fetching,
  fetchingNextPage,
  nextPageError,
  removing,
  onRetry,
  onNextPage,
  onRemove,
}: Readonly<{
  accountId: number;
  post: Post;
  items: Comment[];
  pending: boolean;
  error: boolean;
  hasData: boolean;
  hasNextPage: boolean;
  fetching: boolean;
  fetchingNextPage: boolean;
  nextPageError: boolean;
  removing: number | null;
  onRetry: () => void;
  onNextPage: () => void;
  onRemove: (comment: Comment) => void;
}>) {
  const language = useLanguage();
  let footer: React.ReactElement | null = null;
  if (fetchingNextPage) footer = <Loading />;
  else if (nextPageError) footer = <CommentsPageError language={language} onRetry={onNextPage} />;
  return (
    <FlatList
      contentContainerStyle={ui.content}
      keyboardShouldPersistTaps="handled"
      data={items}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <View style={ui.gap}>
          <PostCard accountId={accountId} post={post} />
          {pending ? <Loading /> : null}
          {error && !hasData ? <CommentsLoadError language={language} onRetry={onRetry} /> : null}
        </View>
      }
      ListEmptyComponent={hasData ? <CommentsEmpty language={language} /> : undefined}
      renderItem={({ item }) => (
        <CommentRow
          accountId={accountId}
          item={item}
          postIsMine={post.is_mine}
          language={language}
          removing={removing}
          onRemove={onRemove}
        />
      )}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasNextPage && !fetching && !nextPageError) onNextPage();
      }}
      ListFooterComponent={footer ?? undefined}
    />
  );
}

function CommentsPageError({
  language,
  onRetry,
}: Readonly<{ language: 'en' | 'es'; onRetry: () => void }>) {
  const p = usePalette();
  return (
    <View style={ui.gap}>
      <Text accessibilityRole="alert" style={{ color: p.danger }}>
        {language === 'es'
          ? 'No se pudieron cargar más comentarios.'
          : 'Could not load more comments.'}
      </Text>
      <Button title={language === 'es' ? 'Reintentar' : 'Retry'} secondary onPress={onRetry} />
    </View>
  );
}

function CommentsLoadError({
  language,
  onRetry,
}: Readonly<{ language: 'en' | 'es'; onRetry: () => void }>) {
  const p = usePalette();
  return (
    <View style={ui.gap}>
      <Text accessibilityRole="alert" style={{ color: p.danger }}>
        {language === 'es' ? 'No se pudieron cargar los comentarios.' : 'Could not load comments.'}
      </Text>
      <Button title={language === 'es' ? 'Reintentar' : 'Retry'} secondary onPress={onRetry} />
    </View>
  );
}

function CommentsEmpty({ language }: Readonly<{ language: 'en' | 'es' }>) {
  const p = usePalette();
  return (
    <Text style={{ color: p['ink-muted'] }}>
      {language === 'es'
        ? 'Aún no hay comentarios. Inicia la conversación.'
        : 'No comments yet. Start the conversation.'}
    </Text>
  );
}

function CommentRow({
  accountId,
  item,
  postIsMine,
  language,
  removing,
  onRemove,
}: Readonly<{
  accountId: number;
  item: Comment;
  postIsMine: boolean;
  language: 'en' | 'es';
  removing: number | null;
  onRemove: (comment: Comment) => void;
}>) {
  const p = usePalette();
  const author = authorName(item.author.display_name);
  return (
    <View style={styles.comment}>
      <PersonAvatar accountId={accountId} person={item.author} size={36} />
      <View style={{ flex: 1, gap: spacing['space-1'] }}>
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          <Text style={[textStyles.label, { color: p.ink }]}>{author}</Text>
          {' · '}
          {relativeTime(item.created_at, undefined, language)}
        </Text>
        <Text style={[textStyles.body, { color: p.ink }]}>{item.comment}</Text>
      </View>
      {item.is_mine || postIsMine ? (
        <IconButton
          icon="trash-2"
          label={
            language === 'es' ? `Eliminar comentario de ${author}` : `Delete comment by ${author}`
          }
          disabled={removing !== null}
          onPress={() => onRemove(item)}
        />
      ) : null}
    </View>
  );
}

function CommentComposer({
  language,
  error,
  draft,
  sending,
  onDraftChange,
  onSend,
}: Readonly<{
  language: 'en' | 'es';
  error: string;
  draft: string;
  sending: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
}>) {
  const p = usePalette();
  return (
    <View style={[styles.composer, { borderColor: p.line, backgroundColor: p['surface-200'] }]}>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          {error}
        </Text>
      ) : null}
      <View style={ui.row}>
        <TextField
          accessibilityLabel={language === 'es' ? 'Escribe un comentario' : 'Write a comment'}
          placeholder={language === 'es' ? 'Escribe un comentario' : 'Write a comment'}
          value={draft}
          onChangeText={onDraftChange}
          maxLength={MAX_COMMENT_TEXT}
          multiline
          editable={!sending}
          containerStyle={{ flex: 1 }}
        />
        <IconButton
          icon={sending ? 'clock' : 'send'}
          label={language === 'es' ? 'Enviar comentario' : 'Send comment'}
          onOverlay
          busy={sending}
          disabled={sending || !draft.trim()}
          onPress={onSend}
        />
      </View>
    </View>
  );
}

function PostComments({
  accountId,
  post,
  onUnavailable,
}: Readonly<{ accountId: number; post: Post; onUnavailable: () => void }>) {
  const language = useLanguage();
  const cache = useQueryClient();
  const key = commentsKey(accountId, post.id);
  const comments = useInfiniteQuery({
    queryKey: key,
    initialPageParam: null as number | null,
    queryFn: ({ pageParam, signal }) => feedApi.comments(post.id, pageParam, signal),
    getNextPageParam: (page) => page.next_after_id ?? undefined,
    retry: false,
  });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<number | null>(null);
  const busy = useRef(false);
  const gone = postMissing(comments.error);
  useEffect(() => {
    if (gone) onUnavailable();
  }, [gone, onUnavailable]);

  function changeCount(delta: number) {
    updatePost(cache, accountId, post.id, (item) => ({
      ...item,
      comment_count: Math.max(0, item.comment_count + delta),
    }));
  }

  function send() {
    void submitComment({
      text: draft,
      postId: post.id,
      key,
      cache,
      busy,
      setSending,
      setError,
      setDraft,
      onUnavailable,
      language,
      onCountChange: () => changeCount(1),
    });
  }

  function remove(comment: Comment) {
    void deleteComment({
      comment,
      postId: post.id,
      key,
      cache,
      removing,
      setRemoving,
      setError,
      onUnavailable,
      refetch: () => comments.refetch(),
      language,
      onCountChange: () => changeCount(-1),
    });
  }

  const items = comments.data?.pages.flatMap((page) => page.items) ?? [];
  if (gone) return null;

  return (
    <KeyboardAvoidingView
      style={ui.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <CommentsList
        accountId={accountId}
        post={post}
        items={items}
        pending={comments.isPending}
        error={comments.isError}
        hasData={Boolean(comments.data)}
        hasNextPage={comments.hasNextPage}
        fetching={comments.isFetching}
        fetchingNextPage={comments.isFetchingNextPage}
        nextPageError={comments.isFetchNextPageError}
        removing={removing}
        onRetry={() => void comments.refetch()}
        onNextPage={() => void comments.fetchNextPage({ cancelRefetch: false })}
        onRemove={remove}
      />
      <CommentComposer
        language={language}
        error={error}
        draft={draft}
        sending={sending}
        onDraftChange={setDraft}
        onSend={send}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing['space-4'], paddingTop: spacing['space-2'] },
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
