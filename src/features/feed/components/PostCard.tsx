import { useLanguage } from '@/i18n/Language';
import { Feather, Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PersonAvatar } from '@/features/friends/components/PersonAvatar';
import { IconButton } from '@/features/training/components/ui';
import { WorkoutSummaryCard } from '@/features/training/components/WorkoutSummaryCard';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { authorName, countLabel, relativeTime } from '../format';
import type { Post, WorkoutSummary } from '../schemas';
import { PostImage } from './PostImage';

type PostCardProps = Readonly<{
  accountId: number;
  post: Post;
  likePending?: boolean;
  likeError?: boolean;
  onLike?: (post: Post) => void;
  onComments?: (post: Post) => void;
  onOptions?: (post: Post) => void;
  onAuthor?: (post: Post) => void;
  onWorkout?: (post: Post) => void;
}>;

export function PostCard({
  accountId,
  post,
  likePending = false,
  likeError,
  onLike,
  onComments,
  onOptions,
  onAuthor,
  onWorkout,
}: PostCardProps) {
  const language = useLanguage();
  const p = usePalette();
  const name = authorName(post.author.display_name);
  return (
    <View
      testID={`post-${post.id}`}
      style={[styles.card, { backgroundColor: p['surface-200'], borderColor: p.line }]}
    >
      <View style={styles.header}>
        <PostByline accountId={accountId} post={post} name={name} onAuthor={onAuthor} />
        {onOptions && (post.is_mine || post.workout) ? (
          <IconButton
            icon={<Feather name="more-horizontal" size={24} color={p.ink} />}
            label={language === 'es' ? 'Opciones de la publicación' : 'Post options'}
            bare
            onPress={() => onOptions(post)}
          />
        ) : null}
      </View>
      <MediaCarousel accountId={accountId} post={post} name={name} />
      {post.caption || post.description ? (
        <View style={styles.copy}>
          {post.caption ? (
            <Text accessibilityRole="header" style={[textStyles['title-lg'], { color: p.ink }]}>
              {post.caption}
            </Text>
          ) : null}
          {post.description ? (
            <Text style={[textStyles.body, { color: p.ink }]}>{post.description}</Text>
          ) : null}
        </View>
      ) : null}
      {post.workout ? (
        <PostWorkoutSummary
          workout={post.workout}
          label={language === 'es' ? `Ver el entrenamiento de ${name}` : `See ${name}’s workout`}
          onPress={onWorkout ? () => onWorkout(post) : undefined}
        />
      ) : null}
      {onLike && onComments ? (
        <PostReactions
          post={post}
          name={name}
          likePending={likePending}
          onLike={() => onLike(post)}
          onComments={() => onComments(post)}
        />
      ) : null}
      {likeError ? (
        <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
          {language === 'es'
            ? 'No se pudo actualizar tu me gusta. Inténtalo de nuevo.'
            : 'Could not update your like. Try again.'}
        </Text>
      ) : null}
    </View>
  );
}

function PostReactions({
  post,
  name,
  likePending,
  onLike,
  onComments,
}: Readonly<{
  post: Post;
  name: string;
  likePending: boolean;
  onLike: () => void;
  onComments: () => void;
}>) {
  const language = useLanguage();
  const p = usePalette();
  return (
    <View style={styles.actions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          language === 'es'
            ? `${post.liked_by_me ? 'Ya no me gusta' : 'Me gusta'} la publicación de ${name}`
            : `${post.liked_by_me ? 'Unlike' : 'Like'} post by ${name}`
        }
        accessibilityState={{
          selected: post.liked_by_me,
          disabled: likePending,
          busy: likePending,
        }}
        disabled={likePending}
        onPress={onLike}
        style={({ pressed }) => [styles.action, { opacity: likePending || pressed ? 0.55 : 1 }]}
      >
        <Ionicons
          name={post.liked_by_me ? 'heart' : 'heart-outline'}
          size={24}
          color={post.liked_by_me ? p.brand : p.ink}
        />
        <Text style={[textStyles.label, styles.tabular, { color: p.ink }]}>
          {countLabel(
            post.like_count,
            language === 'es' ? 'me gusta' : 'like',
            language === 'es' ? 'me gusta' : 'likes',
          )}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${language === 'es' ? `Comentarios de la publicación de ${name}` : `Comments on post by ${name}`}, ${countLabel(post.comment_count, language === 'es' ? 'comentario' : 'comment', language === 'es' ? 'comentarios' : 'comments')}`}
        onPress={onComments}
        style={({ pressed }) => [styles.action, { opacity: pressed ? 0.55 : 1 }]}
      >
        <Ionicons name="chatbubble-outline" size={22} color={p.ink} />
        <Text style={[textStyles.label, styles.tabular, { color: p.ink }]}>
          {countLabel(
            post.comment_count,
            language === 'es' ? 'comentario' : 'comment',
            language === 'es' ? 'comentarios' : 'comments',
          )}
        </Text>
      </Pressable>
    </View>
  );
}

function PostByline({
  accountId,
  post,
  name,
  onAuthor,
}: Readonly<{ accountId: number; post: Post; name: string; onAuthor?: (post: Post) => void }>) {
  const language = useLanguage();
  const p = usePalette();
  const byline = (
    <>
      <PersonAvatar accountId={accountId} person={post.author} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[textStyles['title-md'], { color: p.ink }]}>
          {name}
        </Text>
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {relativeTime(post.created_at, undefined, language)}
          {post.visibility === 'PRIVATE' ? (language === 'es' ? ' · Solo tú' : ' · Only you') : ''}
        </Text>
      </View>
    </>
  );
  if (!onAuthor) return <View style={styles.author}>{byline}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        language === 'es' ? `Abrir el perfil de ${name}` : `Open ${name}’s profile`
      }
      onPress={() => onAuthor(post)}
      style={({ pressed }) => [styles.author, { opacity: pressed ? 0.65 : 1 }]}
    >
      {byline}
    </Pressable>
  );
}

function MediaCarousel({
  accountId,
  post,
  name,
}: Readonly<{ accountId: number; post: Post; name: string }>) {
  const language = useLanguage();
  const p = usePalette();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const total = post.media.length;
  if (!total) return null;
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.media}>
      {width ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(event) =>
            setIndex(Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1)))
          }
        >
          {post.media.map((item, position) => (
            <PostImage
              key={item.id}
              accountId={accountId}
              path={item.url}
              label={
                language === 'es'
                  ? `Foto ${position + 1} de ${total} de ${name}`
                  : `Photo ${position + 1} of ${total} by ${name}`
              }
              style={{ width, height: 160, borderRadius: radii['radius-md'] }}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.photoPlaceholder} />
      )}
      {total > 1 ? (
        <View
          style={styles.dots}
          accessibilityLabel={
            language === 'es' ? `Foto ${index + 1} de ${total}` : `Photo ${index + 1} of ${total}`
          }
        >
          {post.media.map((item, position) => (
            <View
              key={item.id}
              style={[
                styles.dot,
                { backgroundColor: position === index ? p.brand : p['line-strong'] },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const workoutDate = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function PostWorkoutSummary({
  workout,
  label,
  onPress,
}: Readonly<{ workout: WorkoutSummary; label: string; onPress?: () => void }>) {
  const language = useLanguage();
  const date =
    language === 'es'
      ? new Intl.DateTimeFormat('es', { month: 'short', day: 'numeric', year: 'numeric' }).format(
          new Date(workout.ended_at),
        )
      : workoutDate.format(new Date(workout.ended_at));
  return (
    <WorkoutSummaryCard
      embedded
      title={workout.title}
      subtitle={date}
      durationSeconds={workout.duration_seconds}
      volumeKg={workout.total_volume_kg}
      exerciseCount={workout.exercise_count}
      open={onPress ? { label, onPress } : undefined}
    />
  );
}

const styles = StyleSheet.create({
  author: {
    flex: 1,
    minWidth: 0,
    minHeight: sizes['tap-min'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-3'],
  },
  card: {
    borderRadius: radii['radius-lg'],
    borderWidth: 1,
    padding: spacing['space-4'],
    gap: spacing['space-3'],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-3'] },
  copy: { gap: spacing['space-1'] },
  actions: { flexDirection: 'row', gap: spacing['space-4'] },
  action: {
    minHeight: sizes['tap-min'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-2'],
  },
  tabular: { fontVariant: ['tabular-nums'] },
  media: { width: '100%', maxWidth: 300, gap: spacing['space-2'] },
  photoPlaceholder: { height: 160 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing['space-1'] },
  dot: { width: 8, height: 8, borderRadius: radii['radius-pill'] },
});
