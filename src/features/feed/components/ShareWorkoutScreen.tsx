import { getTranslation } from '@/i18n/catalog';
import { useLanguage } from '@/i18n/Language';
import { Feather } from '@expo/vector-icons';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import React, { useRef, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { AnchoredPicker } from '@/components/AnchoredPicker';
import { TextField } from '@/components/TextField';
import { Button, IconButton, Loading, ui } from '@/features/training/components/ui';
import { SessionWorkoutDetailModal } from '@/features/training/components/SessionWorkoutDetail';
import { ApiError } from '@/services/apiClient';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { feedApi, type PostPhoto } from '../api';
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
  active: boolean;
  onClose: () => void;
  onShared: (post: Post) => void;
}>;

export function ShareWorkoutScreen({
  accountId,
  initialSessionId,
  active,
  onClose,
  onShared,
}: ShareWorkoutScreenProps) {
  const language = useLanguage();

  const p = usePalette();
  const requestedSessionId = initialSessionId ?? null;
  const workouts = useQuery({
    queryKey: [...workoutOptionsKey(accountId), requestedSessionId],
    queryFn: ({ signal }) => feedApi.workoutOptions(requestedSessionId, signal),
  });
  const [chosen, setChosen] = useState<WorkoutSummary | null>();
  const [detailSessionId, setDetailSessionId] = useState<number | null>(null);
  const [caption, setCaption] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<PostPhoto[]>([]);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [discardOpen, setDiscardOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const selected = chosen === undefined ? (workouts.data?.selected ?? null) : chosen;
  const unresolvedSelection = requestedSessionId !== null && chosen === undefined && !workouts.data;
  const canShare =
    !unresolvedSelection &&
    Boolean(selected || caption.trim() || description.trim() || photos.length);

  const dirty =
    caption.length > 0 ||
    description.length > 0 ||
    photos.length > 0 ||
    (selected?.session_id ?? null) !== (workouts.data?.selected?.session_id ?? null);

  function back() {
    if (busy.current) return;
    if (detailSessionId !== null) setDetailSessionId(null);
    else if (dirty) setDiscardOpen(true);
    else onClose();
  }

  useHardwareBack(
    () => {
      back();
      return true;
    },
    active && !discardOpen && detailSessionId === null,
  );

  async function pickPhotos() {
    setPhotoError('');
    const room = MAX_POST_IMAGES - photos.length;
    if (room <= 0) return;
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setPhotoError(
            getTranslation(language)('socialAdditional.photoAccessIsNeededAllowAccess_ad01e6'),
          );
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
          getTranslation(language)('socialAdditional.rejectedPhotos', { count: rejected }),
        );
    } catch {
      setPhotoError(getTranslation(language)('socialAdditional.couldNotOpenYourPhotosTry_1be001'));
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
    } catch (error_) {
      // Keep every entered value so the person can correct and retry.
      setError(shareErrorMessage(error_, language));
      if (error_ instanceof ApiError && error_.status === 409) void workouts.refetch();
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
      edges={['top', 'left', 'right', 'bottom']}
      style={[ui.screen, { backgroundColor: p['surface-100'] }]}
    >
      <ScrollView
        aria-hidden={discardOpen || detailSessionId !== null}
        accessibilityElementsHidden={discardOpen || detailSessionId !== null}
        importantForAccessibility={
          discardOpen || detailSessionId !== null ? 'no-hide-descendants' : 'auto'
        }
        contentContainerStyle={ui.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={ui.row}>
          <IconButton
            icon="arrow-left"
            label={getTranslation(language)('socialAdditional.backToFeed_d3d2e0')}
            disabled={pending}
            onPress={back}
          />
          <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
            {getTranslation(language)('socialAdditional.newPost_6d3cf1')}
          </Text>
        </View>

        <View style={ui.gap}>
          <Text nativeID="caption-label" style={[textStyles['title-md'], { color: p.ink }]}>
            {getTranslation(language)('socialAdditional.caption_30b86d')}
          </Text>
          <TextField
            accessibilityLabel={getTranslation(language)('socialAdditional.caption_30b86d')}
            accessibilityLabelledBy="caption-label"
            placeholder={getTranslation(language)('socialAdditional.addAShortCaption_e144e0')}
            value={caption}
            onChangeText={setCaption}
            maxLength={MAX_POST_CAPTION}
            editable={!pending}
          />
        </View>

        <View style={ui.gap}>
          <Text nativeID="description-label" style={[textStyles['title-md'], { color: p.ink }]}>
            {getTranslation(language)('socialAdditional.description_1a7d6f')}
          </Text>
          <TextField
            accessibilityLabel={getTranslation(language)('socialAdditional.description_1a7d6f')}
            accessibilityLabelledBy="description-label"
            placeholder={getTranslation(language)('socialAdditional.howDidItGo_3f223b')}
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

        <WorkoutPicker
          workouts={workouts}
          selected={selected}
          unresolvedSelection={unresolvedSelection}
          unavailableSelection={requestedSessionId !== null && workouts.data?.selected === null}
          pending={pending}
          onPreview={setDetailSessionId}
          onSelect={setChosen}
        />
        <PostPhotos
          photos={photos}
          pending={pending}
          photoError={photoError}
          onPick={() => void pickPhotos()}
          onRemove={(position) => {
            setPhotos((current) => current.filter((_, index) => index !== position));
          }}
        />

        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {getTranslation(language)('socialAdditional.yourFriendsWillSeeThisPost_41a739')}
        </Text>

        {error ? (
          <Text accessibilityRole="alert" style={{ color: p.danger }}>
            {error}
          </Text>
        ) : null}
        <Button
          title={
            pending
              ? getTranslation(language)('socialAdditional.sharing_f88745')
              : getTranslation(language)('socialAdditional.share_50b8b4')
          }
          disabled={pending || !canShare}
          onPress={() => {
            void share();
          }}
        />
      </ScrollView>
      <Modal
        visible={discardOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDiscardOpen(false)}
      >
        <View style={[styles.scrim, { backgroundColor: p.scrim }]}>
          <View
            accessibilityViewIsModal
            style={[ui.card, styles.dialog, { backgroundColor: p['surface-200'] }]}
          >
            <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
              {getTranslation(language)('socialAdditional.discardThisPost_8aae79')}
            </Text>
            <Button
              title={getTranslation(language)('socialAdditional.keepEditing_ba7ea4')}
              secondary
              onPress={() => setDiscardOpen(false)}
            />
            <Button
              title={getTranslation(language)('socialAdditional.discard_671592')}
              tone="danger"
              onPress={onClose}
            />
          </View>
        </View>
      </Modal>
      {detailSessionId !== null ? (
        <SessionWorkoutDetailModal
          accountId={accountId}
          sessionId={detailSessionId}
          backLabel={getTranslation(language)('socialAdditional.backToNewPost_36b7ab')}
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

function WorkoutPicker({
  workouts,
  selected,
  unresolvedSelection,
  unavailableSelection,
  pending,
  onPreview,
  onSelect,
}: Readonly<{
  workouts: UseQueryResult<Awaited<ReturnType<typeof feedApi.workoutOptions>>>;
  selected: WorkoutSummary | null;
  unresolvedSelection: boolean;
  unavailableSelection: boolean;
  pending: boolean;
  onPreview: (sessionId: number) => void;
  onSelect: (workout: WorkoutSummary | null) => void;
}>) {
  const language = useLanguage();

  const p = usePalette();
  const recent = workouts.data?.items ?? [];
  return (
    <View style={ui.gap}>
      <Text style={[textStyles['title-md'], { color: p.ink }]}>
        {getTranslation(language)('socialAdditional.workoutOptional_8aef2f')}
      </Text>
      <AnchoredPicker
        selection={selected?.session_id ?? null}
        options={[
          { value: null, label: getTranslation(language)('socialAdditional.noWorkout_13744e') },
          ...recent.map((workout) => ({
            value: workout.session_id,
            label: workout.title,
            detail: new Date(workout.ended_at).toLocaleString(language),
            action: {
              label: getTranslation(language)('socialAdditional.preview_bc3f4c', {
                value1: workout.title,
              }),
              icon: 'eye-outline' as const,
              onPress: () => onPreview(workout.session_id),
            },
          })),
        ]}
        onSelect={(id) => onSelect(recent.find((workout) => workout.session_id === id) ?? null)}
        labelPrefix={getTranslation(language)('socialAdditional.workoutToShare_c75504')}
        fallbackLabel={
          selected?.title ?? getTranslation(language)('socialAdditional.noWorkout_13744e')
        }
        closeLabel={getTranslation(language)('socialAdditional.closeWorkoutMenu_14a2e5')}
        menuTestId="post-workout-menu"
        icon="barbell-outline"
        disabled={pending}
        showTriggerDetail={false}
        triggerAction={
          selected
            ? {
                label: getTranslation(language)('socialAdditional.previewWorkout_fca315'),
                icon: 'eye-outline',
                onPress: () => onPreview(selected.session_id),
              }
            : null
        }
        menuFooter={
          <WorkoutMenuStatus
            loading={workouts.isPending}
            empty={Boolean(workouts.data && !recent.length)}
          />
        }
      />
      {unresolvedSelection && workouts.isPending ? <Loading /> : null}
      {unavailableSelection ? (
        <Text accessibilityRole="alert" style={{ color: p['ink-muted'] }}>
          {getTranslation(language)('socialAdditional.theWorkoutYouOpenedIsUnavailable_a589d1')}
        </Text>
      ) : null}
      {workouts.isError ? (
        <View style={ui.gap}>
          <Text accessibilityRole="alert" style={{ color: p.danger }}>
            {getTranslation(language)('socialAdditional.couldNotLoadYourWorkouts_58731b')}
          </Text>
          <Button
            title={getTranslation(language)('socialAdditional.retry_95b6f5')}
            secondary
            onPress={() => void workouts.refetch()}
          />
        </View>
      ) : null}
    </View>
  );
}

function PostPhotos({
  photos,
  pending,
  photoError,
  onPick,
  onRemove,
}: Readonly<{
  photos: readonly PostPhoto[];
  pending: boolean;
  photoError: string;
  onPick: () => void;
  onRemove: (position: number) => void;
}>) {
  const language = useLanguage();

  const p = usePalette();
  const [photoInfoOpen, setPhotoInfoOpen] = useState(false);
  return (
    <View style={ui.gap}>
      <View style={ui.row}>
        <Text style={[textStyles['title-md'], { color: p.ink }]}>
          {getTranslation(language)('socialAdditional.photos_e1cdfd')} · {photos.length}/
          {MAX_POST_IMAGES}
        </Text>
        <IconButton
          icon="info"
          label={getTranslation(language)('socialAdditional.photoRequirements_da972c')}
          bare
          expanded={photoInfoOpen}
          onPress={() => setPhotoInfoOpen(!photoInfoOpen)}
        />
      </View>
      {photoInfoOpen ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[textStyles['body-sm'], { color: p['ink-muted'] }]}
        >
          {getTranslation(language)('socialAdditional.useJpegPngOrWebpUp_41952e')}
        </Text>
      ) : null}
      <View style={styles.photos}>
        {photos.map((photo, position) => (
          <View key={`${photo.uri}-${position}`} style={styles.thumbnail}>
            <Image
              accessibilityLabel={getTranslation(language)(
                'socialAdditional.selectedPhoto_079da1',
                { value1: position + 1 },
              )}
              source={{ uri: photo.uri }}
              style={[StyleSheet.absoluteFill, { borderRadius: radii['radius-md'] }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={getTranslation(language)('socialAdditional.removePhoto_03a3f5', {
                value1: position + 1,
              })}
              disabled={pending}
              onPress={() => onRemove(position)}
              style={[styles.remove, { backgroundColor: p['surface-300'] }]}
            >
              <Feather name="x" size={18} color={p.ink} />
            </Pressable>
          </View>
        ))}
        {photos.length < MAX_POST_IMAGES ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={getTranslation(language)('socialAdditional.addPhotos_ddc69d')}
            disabled={pending}
            onPress={onPick}
            style={[
              styles.thumbnail,
              styles.add,
              { backgroundColor: p['brand-soft'], borderColor: p['line-strong'] },
            ]}
          >
            <Feather name="plus" size={26} color={p['brand-ink']} />
            <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
              {getTranslation(language)('socialAdditional.add_8d5f06')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {photoError ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          {photoError}
        </Text>
      ) : null}
    </View>
  );
}

function WorkoutMenuStatus({ loading, empty }: Readonly<{ loading: boolean; empty: boolean }>) {
  const language = useLanguage();

  const p = usePalette();
  if (loading) return <Loading />;
  if (!empty) return null;
  return (
    <Text style={[textStyles['body-sm'], { color: p['ink-muted'], padding: spacing['space-2'] }]}>
      {getTranslation(language)('socialAdditional.noFinishedWorkoutsAvailableToShare_78a601')}
    </Text>
  );
}

export function shareErrorMessage(error: unknown, language: 'en' | 'es' = 'en') {
  if (error instanceof ApiError) {
    if (error.status === 409)
      return getTranslation(language)('socialAdditional.youAlreadySharedThisWorkoutChoose_f81769');
    if (error.status === 413)
      return getTranslation(language)('socialAdditional.photosAreTooLargeUseUp_10a1cb');
    if (error.status === 415)
      return getTranslation(language)('socialAdditional.useJpegPngOrWebpPhotos_92cbfa');
    if (error.status === 422)
      return getTranslation(language)('socialAdditional.addACaptionDescriptionPhotoOr_4f9c6c');
    if (error.status === 503)
      return getTranslation(language)('socialAdditional.photoUploadIsUnavailableRightNow_285c89');
    if ([401, 403].includes(error.status))
      return getTranslation(language)('socialAdditional.yourAccountCannotShareRightNow_6b9e4c');
  }
  return getTranslation(language)('socialAdditional.couldNotShareYourPostYour_9b1fb4');
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['space-6'] },
  dialog: { width: '100%', maxWidth: 420 },
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
