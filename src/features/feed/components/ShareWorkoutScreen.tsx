import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import React, { useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextField } from '@/components/TextField';
import { Button, IconButton, Loading, ui } from '@/features/training/components/ui';
import { SessionWorkoutDetailModal } from '@/features/training/components/SessionWorkoutDetail';
import { ApiError } from '@/services/apiClient';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { feedApi, type PostPhoto } from '../api';
import { countLabel } from '../format';
import { workoutOptionsKey } from '../cache';
import {
  MAX_POST_CAPTION,
  MAX_POST_DESCRIPTION,
  MAX_POST_IMAGE_BYTES,
  MAX_POST_IMAGES,
  POST_IMAGE_TYPES,
  type Post,
  type WorkoutSummary,
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
  const requestedSessionId = initialSessionId ?? null;
  const workouts = useQuery({
    queryKey: [...workoutOptionsKey(accountId), requestedSessionId],
    queryFn: ({ signal }) => feedApi.workoutOptions(requestedSessionId, signal),
  });
  const [chosen, setChosen] = useState<WorkoutSummary | null>();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [detailSessionId, setDetailSessionId] = useState<number | null>(null);
  const [caption, setCaption] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<PostPhoto[]>([]);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const recent = workouts.data?.items ?? [];
  const selected = chosen === undefined ? (workouts.data?.selected ?? null) : chosen;
  const unresolvedSelection = requestedSessionId !== null && chosen === undefined && !workouts.data;
  const canShare =
    !unresolvedSelection &&
    Boolean(selected || caption.trim() || description.trim() || photos.length);

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
      const { accepted, rejected } = acceptPhotos(result.assets.slice(0, room));
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
        trainingSessionId: selected?.session_id ?? null,
        caption,
        description,
        visibility: 'FRIENDS',
        photos,
      });
    } catch (failure) {
      // Keep every entered value so the person can correct and retry.
      setError(shareErrorMessage(failure));
      if (failure instanceof ApiError && failure.status === 409) void workouts.refetch();
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
      <ScrollView
        aria-hidden={detailSessionId !== null}
        accessibilityElementsHidden={detailSessionId !== null}
        importantForAccessibility={detailSessionId !== null ? 'no-hide-descendants' : 'auto'}
        contentContainerStyle={ui.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={ui.row}>
          <IconButton icon="arrow-left" label="Back to feed" onPress={onClose} />
          <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
            New post
          </Text>
        </View>

        <View style={ui.gap}>
          <Text nativeID="caption-label" style={[textStyles['title-md'], { color: p.ink }]}>
            Caption
          </Text>
          <TextField
            accessibilityLabel="Caption"
            accessibilityLabelledBy="caption-label"
            placeholder="Add a short caption"
            value={caption}
            onChangeText={setCaption}
            maxLength={MAX_POST_CAPTION}
            editable={!pending}
          />
        </View>

        <View style={ui.gap}>
          <Text nativeID="description-label" style={[textStyles['title-md'], { color: p.ink }]}>
            Description
          </Text>
          <TextField
            accessibilityLabel="Description"
            accessibilityLabelledBy="description-label"
            placeholder="How did it go?"
            value={description}
            onChangeText={setDescription}
            maxLength={MAX_POST_DESCRIPTION}
            multiline
            editable={!pending}
            inputStyle={{ minHeight: 96, textAlignVertical: 'top' }}
          />
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'], textAlign: 'right' }]}>
            {description.length}/{MAX_POST_DESCRIPTION}
          </Text>
        </View>

        <View style={ui.gap}>
          <Text style={[textStyles['title-md'], { color: p.ink }]}>Workout · optional</Text>
          <View style={ui.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Workout to share: ${selected?.title ?? 'No workout'}`}
              accessibilityState={{ expanded: dropdownOpen, disabled: pending }}
              onPress={() => setDropdownOpen(!dropdownOpen)}
              disabled={pending}
              style={[
                styles.option,
                { flex: 1, backgroundColor: p['surface-300'], borderColor: p['line-strong'] },
              ]}
            >
              <Text style={[textStyles.label, { color: p.ink, flex: 1 }]} numberOfLines={1}>
                {selected?.title ?? 'No workout'}
              </Text>
              <Feather
                name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={p.ink}
              />
            </Pressable>
            {selected ? (
              <IconButton
                icon="eye"
                label="Preview workout"
                disabled={pending}
                onPress={() => {
                  setDropdownOpen(false);
                  setDetailSessionId(selected.session_id);
                }}
              />
            ) : null}
          </View>
          {unresolvedSelection && workouts.isPending ? <Loading /> : null}
          {requestedSessionId !== null && workouts.data && !workouts.data.selected ? (
            <Text accessibilityRole="alert" style={{ color: p['ink-muted'] }}>
              The workout you opened is unavailable to share. Choose another workout or post without
              one.
            </Text>
          ) : null}
          {workouts.isError ? (
            <View style={ui.gap}>
              <Text accessibilityRole="alert" style={{ color: p.danger }}>
                Could not load your workouts.
              </Text>
              <Button title="Retry" secondary onPress={() => void workouts.refetch()} />
            </View>
          ) : null}
          {dropdownOpen ? (
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Workout options"
              style={ui.gap}
            >
              <WorkoutOption
                checked={selected === null}
                disabled={pending}
                onPress={() => {
                  setChosen(null);
                  setDropdownOpen(false);
                }}
              />
              {workouts.isPending && !unresolvedSelection ? <Loading /> : null}
              {workouts.data && !recent.length ? (
                <Text style={{ color: p['ink-muted'] }}>
                  No finished workouts available to share.
                </Text>
              ) : null}
              {recent.map((workout) => (
                <WorkoutOption
                  key={workout.session_id}
                  workout={workout}
                  checked={workout.session_id === selected?.session_id}
                  disabled={pending}
                  onPress={() => {
                    setChosen(workout);
                    setDropdownOpen(false);
                  }}
                />
              ))}
            </View>
          ) : null}
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
      {detailSessionId !== null ? (
        <SessionWorkoutDetailModal
          accountId={accountId}
          sessionId={detailSessionId}
          backLabel="Back to new post"
          onBack={() => setDetailSessionId(null)}
          showShare={false}
        />
      ) : null}
    </SafeAreaView>
  );
}

type PickedAsset = ImagePicker.ImagePickerAsset;

/** Keeps JPEG, PNG and WebP photos up to the size limit and counts the rest. */
export function acceptPhotos(assets: readonly PickedAsset[]) {
  const accepted: PostPhoto[] = [];
  let rejected = 0;
  for (const asset of assets) {
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
  return { accepted, rejected };
}

function WorkoutOption({
  workout,
  checked,
  disabled,
  onPress,
}: Readonly<{
  workout?: WorkoutSummary;
  checked: boolean;
  disabled: boolean;
  onPress: () => void;
}>) {
  const p = usePalette();
  const title = workout?.title ?? 'No workout';
  const when = workout ? new Date(workout.ended_at).toLocaleString() : null;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={when ? `${title}. Workout finished ${when}` : title}
      accessibilityState={{ checked, disabled }}
      aria-checked={checked}
      disabled={disabled}
      onPress={onPress}
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
        size={20}
        color={checked ? p['brand-ink'] : p['ink-muted']}
      />
      <View style={{ flex: 1 }}>
        <Text style={[textStyles.label, { color: p.ink }]}>{title}</Text>
        {when ? (
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{when}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function shareErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'You already shared this workout. Choose another one.';
    if (error.status === 413) return 'Photos are too large. Use up to 5 photos of 5 MB each.';
    if (error.status === 415) return 'Use JPEG, PNG or WebP photos.';
    if (error.status === 422)
      return 'Add a caption, description, photo or workout. Check any attachments and try again.';
    if (error.status === 503)
      return 'Photo upload is unavailable right now. Remove the photos or try again later.';
    if ([401, 403].includes(error.status))
      return 'Your account cannot share right now. Sign out and sign in again.';
  }
  return 'Could not share your post. Your caption, description and photos are kept. Try again.';
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
