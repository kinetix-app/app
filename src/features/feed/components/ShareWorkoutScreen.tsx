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
  const t = (en: string, es: string) => (language === 'es' ? es : en);
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
            t(
              'Photo access is needed. Allow access in Settings, then try again.',
              'Se necesita acceso a las fotos. Permítelo en Ajustes e inténtalo de nuevo.',
            ),
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
          language === 'es'
            ? `${countLabel(rejected, 'foto omitida', 'fotos omitidas')}. Usa JPEG, PNG o WebP de hasta 5 MB cada una.`
            : `${countLabel(rejected, 'photo')} skipped. Use JPEG, PNG or WebP up to 5 MB each.`,
        );
    } catch {
      setPhotoError(
        t(
          'Could not open your photos. Try again.',
          'No se pudieron abrir tus fotos. Inténtalo de nuevo.',
        ),
      );
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
            label={t('Back to feed', 'Volver al feed')}
            disabled={pending}
            onPress={back}
          />
          <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
            {t('New post', 'Nueva publicación')}
          </Text>
        </View>

        <View style={ui.gap}>
          <Text nativeID="caption-label" style={[textStyles['title-md'], { color: p.ink }]}>
            {t('Caption', 'Título')}
          </Text>
          <TextField
            accessibilityLabel={t('Caption', 'Título')}
            accessibilityLabelledBy="caption-label"
            placeholder={t('Add a short caption', 'Añade un título breve')}
            value={caption}
            onChangeText={setCaption}
            maxLength={MAX_POST_CAPTION}
            editable={!pending}
          />
        </View>

        <View style={ui.gap}>
          <Text nativeID="description-label" style={[textStyles['title-md'], { color: p.ink }]}>
            {t('Description', 'Descripción')}
          </Text>
          <TextField
            accessibilityLabel={t('Description', 'Descripción')}
            accessibilityLabelledBy="description-label"
            placeholder={t('How did it go?', '¿Cómo ha ido?')}
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
          {t(
            'Your friends will see this post in their feed.',
            'Tus amigos verán esta publicación en su feed.',
          )}
        </Text>

        {error ? (
          <Text accessibilityRole="alert" style={{ color: p.danger }}>
            {error}
          </Text>
        ) : null}
        <Button
          title={pending ? t('Sharing…', 'Compartiendo…') : t('Share', 'Compartir')}
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
              {t('Discard this post?', '¿Descartar esta publicación?')}
            </Text>
            <Button
              title={t('Keep editing', 'Seguir editando')}
              secondary
              onPress={() => setDiscardOpen(false)}
            />
            <Button title={t('Discard', 'Descartar')} tone="danger" onPress={onClose} />
          </View>
        </View>
      </Modal>
      {detailSessionId !== null ? (
        <SessionWorkoutDetailModal
          accountId={accountId}
          sessionId={detailSessionId}
          backLabel={t('Back to new post', 'Volver a la nueva publicación')}
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
  const t = (en: string, es: string) => (language === 'es' ? es : en);
  const p = usePalette();
  const recent = workouts.data?.items ?? [];
  return (
    <View style={ui.gap}>
      <Text style={[textStyles['title-md'], { color: p.ink }]}>
        {t('Workout · optional', 'Entrenamiento · opcional')}
      </Text>
      <AnchoredPicker
        selection={selected?.session_id ?? null}
        options={[
          { value: null, label: t('No workout', 'Sin entrenamiento') },
          ...recent.map((workout) => ({
            value: workout.session_id,
            label: workout.title,
            detail: new Date(workout.ended_at).toLocaleString(language === 'es' ? 'es' : undefined),
            action: {
              label: language === 'es' ? `Ver ${workout.title}` : `Preview ${workout.title}`,
              icon: 'eye-outline' as const,
              onPress: () => onPreview(workout.session_id),
            },
          })),
        ]}
        onSelect={(id) => onSelect(recent.find((workout) => workout.session_id === id) ?? null)}
        labelPrefix={t('Workout to share', 'Entrenamiento para compartir')}
        fallbackLabel={selected?.title ?? t('No workout', 'Sin entrenamiento')}
        closeLabel={t('Close workout menu', 'Cerrar menú de entrenamiento')}
        menuTestId="post-workout-menu"
        icon="barbell-outline"
        disabled={pending}
        showTriggerDetail={false}
        triggerAction={
          selected
            ? {
                label: t('Preview workout', 'Ver entrenamiento'),
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
          {t(
            'The workout you opened is unavailable to share. Choose another workout or post without one.',
            'El entrenamiento que abriste no se puede compartir. Elige otro o publica sin entrenamiento.',
          )}
        </Text>
      ) : null}
      {workouts.isError ? (
        <View style={ui.gap}>
          <Text accessibilityRole="alert" style={{ color: p.danger }}>
            {t('Could not load your workouts.', 'No se pudieron cargar tus entrenamientos.')}
          </Text>
          <Button
            title={t('Retry', 'Reintentar')}
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
  const t = (en: string, es: string) => (language === 'es' ? es : en);
  const p = usePalette();
  const [photoInfoOpen, setPhotoInfoOpen] = useState(false);
  return (
    <View style={ui.gap}>
      <View style={ui.row}>
        <Text style={[textStyles['title-md'], { color: p.ink }]}>
          {t('Photos', 'Fotos')} · {photos.length}/{MAX_POST_IMAGES}
        </Text>
        <IconButton
          icon="info"
          label={t('Photo requirements', 'Requisitos de las fotos')}
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
          {t(
            'Use JPEG, PNG or WebP up to 5 MB each. Location and other photo details are removed.',
            'Usa JPEG, PNG o WebP de hasta 5 MB cada una. Se eliminan la ubicación y otros datos de las fotos.',
          )}
        </Text>
      ) : null}
      <View style={styles.photos}>
        {photos.map((photo, position) => (
          <View key={`${photo.uri}-${position}`} style={styles.thumbnail}>
            <Image
              accessibilityLabel={
                language === 'es'
                  ? `Foto seleccionada ${position + 1}`
                  : `Selected photo ${position + 1}`
              }
              source={{ uri: photo.uri }}
              style={[StyleSheet.absoluteFill, { borderRadius: radii['radius-md'] }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                language === 'es' ? `Eliminar foto ${position + 1}` : `Remove photo ${position + 1}`
              }
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
            accessibilityLabel={t('Add photos', 'Añadir fotos')}
            disabled={pending}
            onPress={onPick}
            style={[
              styles.thumbnail,
              styles.add,
              { backgroundColor: p['brand-soft'], borderColor: p['line-strong'] },
            ]}
          >
            <Feather name="plus" size={26} color={p['brand-ink']} />
            <Text style={[textStyles.label, { color: p['brand-ink'] }]}>{t('Add', 'Añadir')}</Text>
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
  const t = (en: string, es: string) => (language === 'es' ? es : en);
  const p = usePalette();
  if (loading) return <Loading />;
  if (!empty) return null;
  return (
    <Text style={[textStyles['body-sm'], { color: p['ink-muted'], padding: spacing['space-2'] }]}>
      {t(
        'No finished workouts available to share.',
        'No hay entrenamientos finalizados para compartir.',
      )}
    </Text>
  );
}

export function shareErrorMessage(error: unknown, language: 'en' | 'es' = 'en') {
  const t = (en: string, es: string) => (language === 'es' ? es : en);
  if (error instanceof ApiError) {
    if (error.status === 409)
      return t(
        'You already shared this workout. Choose another one.',
        'Ya compartiste este entrenamiento. Elige otro.',
      );
    if (error.status === 413)
      return t(
        'Photos are too large. Use up to 5 photos of 5 MB each.',
        'Las fotos son demasiado grandes. Usa hasta 5 fotos de 5 MB cada una.',
      );
    if (error.status === 415)
      return t('Use JPEG, PNG or WebP photos.', 'Usa fotos JPEG, PNG o WebP.');
    if (error.status === 422)
      return t(
        'Add a caption, description, photo or workout. Check any attachments and try again.',
        'Añade un título, descripción, foto o entrenamiento. Revisa los adjuntos e inténtalo de nuevo.',
      );
    if (error.status === 503)
      return t(
        'Photo upload is unavailable right now. Remove the photos or try again later.',
        'La subida de fotos no está disponible. Elimina las fotos o inténtalo más tarde.',
      );
    if ([401, 403].includes(error.status))
      return t(
        'Your account cannot share right now. Sign out and sign in again.',
        'Tu cuenta no puede compartir ahora. Cierra sesión y vuelve a iniciarla.',
      );
  }
  return t(
    'Could not share your post. Your caption, description and photos are kept. Try again.',
    'No se pudo compartir la publicación. Se conservan el título, la descripción y las fotos. Inténtalo de nuevo.',
  );
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
