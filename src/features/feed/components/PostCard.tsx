import { Ionicons } from '@expo/vector-icons';
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
  likePending: boolean;
  likeError: boolean;
  onLike: (post: Post) => void;
  onComments: (post: Post) => void;
  onOptions?: (post: Post) => void;
  onAuthor: (post: Post) => void;
  onWorkout?: (post: Post) => void;
}>;

export function PostCard({
  accountId,
  post,
  likePending,
  likeError,
  onLike,
  onComments,
  onOptions,
  onAuthor,
  onWorkout,
}: PostCardProps) {
  const p = usePalette();
  const name = authorName(post.author.display_name);
  return (
    <View
      testID={`post-${post.id}`}
      style={[styles.card, { backgroundColor: p['surface-200'], borderColor: p.line }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${name}’s profile`}
          onPress={() => onAuthor(post)}
          style={({ pressed }) => [styles.author, { opacity: pressed ? 0.65 : 1 }]}
        >
          <PersonAvatar accountId={accountId} person={post.author} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[textStyles['title-md'], { color: p.ink }]}>
              {name}
            </Text>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              {relativeTime(post.created_at)}
              {visibilityNote[post.visibility] ?? ''}
            </Text>
          </View>
        </Pressable>
        {onOptions && (post.is_mine || post.workout) ? (
          <IconButton icon="more-horizontal" label="Post options" onPress={() => onOptions(post)} />
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
          label={`See ${name}’s workout`}
          onPress={onWorkout ? () => onWorkout(post) : undefined}
        />
      ) : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${post.liked_by_me ? 'Unlike' : 'Like'} post by ${name}`}
          accessibilityState={{
            selected: post.liked_by_me,
            disabled: likePending,
            busy: likePending,
          }}
          disabled={likePending}
          onPress={() => onLike(post)}
          style={({ pressed }) => [styles.action, { opacity: likePending || pressed ? 0.55 : 1 }]}
        >
          <Ionicons
            name={post.liked_by_me ? 'heart' : 'heart-outline'}
            size={24}
            color={post.liked_by_me ? p.brand : p.ink}
          />
          <Text style={[textStyles.label, styles.tabular, { color: p.ink }]}>
            {countLabel(post.like_count, 'like')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Comments on post by ${name}, ${countLabel(post.comment_count, 'comment')}`}
          onPress={() => onComments(post)}
          style={({ pressed }) => [styles.action, { opacity: pressed ? 0.55 : 1 }]}
        >
          <Ionicons name="chatbubble-outline" size={22} color={p.ink} />
          <Text style={[textStyles.label, styles.tabular, { color: p.ink }]}>
            {countLabel(post.comment_count, 'comment')}
          </Text>
        </Pressable>
      </View>
      {likeError ? (
        <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
          Could not update your like. Try again.
        </Text>
      ) : null}
    </View>
  );
}

function MediaCarousel({
  accountId,
  post,
  name,
}: Readonly<{ accountId: number; post: Post; name: string }>) {
  const p = usePalette();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const total = post.media.length;
  if (!total) return null;
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ borderRadius: radii['radius-md'], overflow: 'hidden', gap: spacing['space-2'] }}
    >
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
              label={`Photo ${position + 1} of ${total} by ${name}`}
              style={{ width, height: width, borderRadius: radii['radius-md'] }}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={{ aspectRatio: 1 }} />
      )}
      {total > 1 ? (
        <View style={styles.dots} accessibilityLabel={`Photo ${index + 1} of ${total}`}>
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
  const date = workoutDate.format(new Date(workout.ended_at));
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

const visibilityNote: Partial<Record<Post['visibility'], string>> = {
  PRIVATE: ' · Only you',
};

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
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing['space-1'] },
  dot: { width: 8, height: 8, borderRadius: radii['radius-pill'] },
});
