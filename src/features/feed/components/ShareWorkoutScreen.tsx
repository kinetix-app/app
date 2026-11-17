import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import React, { useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextField } from '@/components/TextField';
import { trainingApi } from '@/features/training/api';
import { Button, IconButton, Loading, ui } from '@/features/training/components/ui';
import { ApiError } from '@/services/apiClient';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { feedApi, type PostPhoto } from '../api';
import { countLabel } from '../format';
import {
  MAX_POST_IMAGE_BYTES,
  MAX_POST_IMAGES,
  MAX_POST_TEXT,
  POST_IMAGE_TYPES,
  type Post,
} from '../schemas';

type ShareWorkoutScreenProps = Readonly<{
  accountId: number;
  initialSessionId?: number | null;
  onClose: () => void;
  onShared: (post: Post) => void;
}>;

export function ShareWorkoutScreen({
  accountId,
  initialSessionId,
  onClose,
  onShared,
}: ShareWorkoutScreenProps) {
  const p = usePalette();
  // The training prefix is refreshed whenever a workout finishes.
  const workouts = useQuery({
    queryKey: ['training', accountId, 'sessions', 'kg', 'recent'],
    queryFn: ({ signal }) => trainingApi.sessions(0, 'kg', signal),
  });
  // 'none' is an explicit post without a workout; null means "not chosen yet".
  const [chosen, setSelected] = useState<number | 'none' | null>(initialSessionId ?? null);
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<PostPhoto[]>([]);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const recent = workouts.data?.items.slice(0, 10) ?? [];
  // Default to the most recent workout until the person picks one.
  const selected = chosen === 'none' ? null : (chosen ?? recent[0]?.id ?? null);
  const canShare = selected !== null || text.trim().length > 0 || photos.length > 0;

  async function pickPhotos() {
    setPhotoError('');
    const room = MAX_POST_IMAGES - photos.length;
    if (room <= 0) return;
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setPhotoError('Photo access is needed. Allow access in Settings, then try again.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: room,
        quality: 0.85,
      });
      if (result.canceled) return;
      const accepted: PostPhoto[] = [];
      let rejected = 0;
      for (const asset of result.assets.slice(0, room)) {
        const type = asset.mimeType ?? asset.file?.type ?? 'image/jpeg';
        const size = asset.fileSize ?? asset.file?.size ?? 0;
        if (size > MAX_POST_IMAGE_BYTES || !POST_IMAGE_TYPES.includes(type)) {
          rejected += 1;
          continue;
        }
        accepted.push({
          uri: asset.uri,
          name: asset.fileName ?? `photo-${Date.now()}-${accepted.length + 1}.jpg`,
          type,
          file: Platform.OS === 'web' ? asset.file : undefined,
        });
      }
      setPhotos((current) => [...current, ...accepted].slice(0, MAX_POST_IMAGES));
      if (rejected)
        setPhotoError(
          `${countLabel(rejected, 'photo')} skipped. Use JPEG, PNG or WebP up to 5 MB each.`,
        );
    } catch {
      setPhotoError('Could not open your photos. Try again.');
    }
  }

  async function share() {
    if (busy.current || !canShare) return;
    busy.current = true;
    setPending(true);
    setError('');
    let post: Post;
    try {
      // Every post goes to the author's friends.
      post = await feedApi.create({
        trainingSessionId: selected,
        text,
        visibility: 'FRIENDS',
        photos,
      });
    } catch (failure) {
      // Keep every entered value so the person can correct and retry.
      setError(shareErrorMessage(failure));
      busy.current = false;
      setPending(false);
      return;
    }
    busy.current = false;
    // The parent closes this screen; no state updates may follow.
    onShared(post);
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[ui.screen, { backgroundColor: p['surface-100'] }]}
    >
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <View style={ui.row}>
          <IconButton icon="arrow-left" label="Back to feed" onPress={onClose} />
          <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
            New post
          </Text>
        </View>

        <View style={ui.gap}>
          <Text style={[textStyles['title-md'], { color: p.ink }]}>Workout · optional</Text>
          {workouts.isPending ? <Loading /> : null}
          {workouts.isError ? (
            <View style={ui.gap}>
              <Text accessibilityRole="alert" style={{ color: p.danger }}>
                Could not load your workouts.
              </Text>
              <Button title="Retry" secondary onPress={() => void workouts.refetch()} />
            </View>
          ) : null}
          {workouts.data && !recent.length ? (
            <Text style={{ color: p['ink-muted'] }}>
              No finished workouts yet. You can still post a caption or photos.
            </Text>
          ) : null}
          <View accessibilityRole="radiogroup" accessibilityLabel="Workout to share" style={ui.gap}>
            {recent.length ? (
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel="No workout. Post only a caption or photos"
                accessibilityState={{ checked: selected === null, disabled: pending }}
                disabled={pending}
                onPress={() => setSelected('none')}
                style={[
                  styles.option,
                  {
                    backgroundColor: selected === null ? p['brand-soft'] : p['surface-200'],
                    borderColor: selected === null ? p.brand : p['line-strong'],
                  },
                ]}
              >
                <Feather
                  name={selected === null ? 'check-circle' : 'circle'}
                  size={22}
                  color={selected === null ? p['brand-ink'] : p['ink-muted']}
                />
                <Text
                  style={[textStyles.label, { color: selected === null ? p['brand-ink'] : p.ink }]}
                >
                  No workout
                </Text>
              </Pressable>
            ) : null}
            {recent.map((workout) => {
              const checked = workout.id === selected;
              const sets = workout.exercises.reduce((sum, slot) => sum + slot.sets.length, 0);
              const when = new Date(workout.ended_at).toLocaleString();
              return (
                <Pressable
                  key={workout.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`Workout finished ${when}`}
                  accessibilityState={{ checked, disabled: pending }}
                  disabled={pending}
                  onPress={() => setSelected(workout.id)}
                  style={[
                    styles.option,
                    {
                      backgroundColor: checked ? p['brand-soft'] : p['surface-200'],
                      borderColor: checked ? p.brand : p['line-strong'],
                    },
                  ]}
                >
                  <Feather
                    name={checked ? 'check-circle' : 'circle'}
                    size={22}
                    color={checked ? p['brand-ink'] : p['ink-muted']}
                  />
                  <View style={{ flex: 1, gap: spacing['space-1'] }}>
                    <Text style={[textStyles.label, { color: checked ? p['brand-ink'] : p.ink }]}>
                      {when}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[
                        textStyles['body-sm'],
                        { color: checked ? p['brand-ink'] : p['ink-muted'] },
                      ]}
                    >
                      {countLabel(workout.exercises.length, 'exercise')} · {countLabel(sets, 'set')}
                      {workout.exercises.length
                        ? ` · ${workout.exercises.map((slot) => slot.exercise.name).join(', ')}`
                        : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={ui.gap}>
          <Text nativeID="caption-label" style={[textStyles['title-md'], { color: p.ink }]}>
            Caption
          </Text>
          <TextField
            accessibilityLabel="Caption"
            accessibilityLabelledBy="caption-label"
            placeholder="How did it go?"
            value={text}
            onChangeText={setText}
            maxLength={MAX_POST_TEXT}
            multiline
            editable={!pending}
            inputStyle={{ minHeight: 96, textAlignVertical: 'top' }}
          />
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'], textAlign: 'right' }]}>
            {text.length}/{MAX_POST_TEXT}
          </Text>
        </View>

        <View style={ui.gap}>
          <Text style={[textStyles['title-md'], { color: p.ink }]}>
            Photos · {photos.length}/{MAX_POST_IMAGES}
          </Text>
          <View style={styles.photos}>
            {photos.map((photo, position) => (
              <View key={`${photo.uri}-${position}`} style={styles.thumbnail}>
                <Image
                  accessibilityLabel={`Selected photo ${position + 1}`}
                  source={{ uri: photo.uri }}
                  style={[StyleSheet.absoluteFill, { borderRadius: radii['radius-md'] }]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${position + 1}`}
                  disabled={pending}
                  onPress={() =>
                    setPhotos((current) => current.filter((_, index) => index !== position))
                  }
                  style={[styles.remove, { backgroundColor: p['surface-300'] }]}
                >
                  <Feather name="x" size={18} color={p.ink} />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_POST_IMAGES ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add photos"
                disabled={pending}
                onPress={() => {
                  void pickPhotos();
                }}
                style={[
                  styles.thumbnail,
                  styles.add,
                  { backgroundColor: p['brand-soft'], borderColor: p['line-strong'] },
                ]}
              >
                <Feather name="plus" size={26} color={p['brand-ink']} />
                <Text style={[textStyles.label, { color: p['brand-ink'] }]}>Add</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            Optional · JPEG, PNG or WebP up to 5 MB. Location and other photo details are removed.
          </Text>
          {photoError ? (
            <Text accessibilityRole="alert" style={{ color: p.danger }}>
              {photoError}
            </Text>
          ) : null}
        </View>

        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          Your friends will see this post in their feed.
        </Text>

        {error ? (
          <Text accessibilityRole="alert" style={{ color: p.danger }}>
            {error}
          </Text>
        ) : null}
        <Button
          title={pending ? 'Sharing…' : 'Share'}
          disabled={pending || !canShare}
          onPress={() => {
            void share();
          }}
        />
        <Button title="Cancel" secondary disabled={pending} onPress={onClose} />
      </ScrollView>
    </SafeAreaView>
  );
}

export function shareErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'You already shared this workout. Choose another one.';
    if (error.status === 413) return 'Photos are too large. Use up to 5 photos of 5 MB each.';
    if (error.status === 415) return 'Use JPEG, PNG or WebP photos.';
    if (error.status === 422)
      return 'Add a caption, a photo or a workout. If you chose a workout or photos, check them and try again.';
    if (error.status === 503)
      return 'Photo upload is unavailable right now. Remove the photos or try again later.';
    if ([401, 403].includes(error.status))
      return 'Your account cannot share right now. Sign out and sign in again.';
  }
  return 'Could not share your workout. Your caption and photos are kept. Try again.';
}

const styles = StyleSheet.create({
  option: {
    minHeight: sizes['control-height'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-3'],
    padding: spacing['space-3'],
    borderRadius: radii['radius-md'],
    borderWidth: 1,
  },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-3'] },
  thumbnail: { width: 88, height: 88, borderRadius: radii['radius-md'] },
  remove: {
    position: 'absolute',
    top: -spacing['space-2'],
    right: -spacing['space-2'],
    width: sizes['tap-min'],
    height: sizes['tap-min'],
    borderRadius: radii['radius-pill'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['space-1'],
  },
});
