import { getTranslation } from '@/i18n/catalog';
import React, { useState } from 'react';
import { useLanguage } from '@/i18n/Language';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, spacing, usePalette } from '@/theme/tokens';
import { useSession } from './SessionProvider';
import { WorkoutTimer } from './WorkoutEditor';
import { OngoingSession } from './OngoingSession';
import { Button, IconButton, Loading, ui } from './ui';

export function SessionHost({
  children,
  hideMinimized = false,
  reserveMinimizedSpace = false,
}: Readonly<
  React.PropsWithChildren<{
    hideMinimized?: boolean;
    reserveMinimizedSpace?: boolean;
  }>
>) {
  const session = useSession();
  const p = usePalette();
  const [discard, setDiscard] = useState(false);
  return (
    <View style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
      <View
        style={ui.screen}
        aria-hidden={discard || Boolean(session.draft && !session.draft.minimized)}
        accessibilityElementsHidden={discard || Boolean(session.draft && !session.draft.minimized)}
        importantForAccessibility={
          discard || (session.draft && !session.draft.minimized) ? 'no-hide-descendants' : 'auto'
        }
      >
        {children}
        {!session.ready ? <PendingSessionState onDiscard={() => setDiscard(true)} /> : null}
        {session.ready && session.storageError && !session.draft ? <StorageErrorState /> : null}
      </View>
      {session.draft?.minimized && !discard && !hideMinimized ? (
        <MinimizedWorkoutCard inFlow={reserveMinimizedSpace} onDiscard={() => setDiscard(true)} />
      ) : null}
      <Modal
        transparent
        visible={Boolean(session.draft && !session.draft.minimized)}
        animationType="slide"
        onRequestClose={() => session.change((value) => ({ ...value, minimized: true }))}
      >
        <View
          testID="workout-modal-surface"
          style={[ui.screen, { backgroundColor: p['surface-100'] }]}
        >
          {session.draft ? <OngoingSession /> : null}
        </View>
      </Modal>
      <DiscardConfirmation
        visible={discard}
        onCancel={() => setDiscard(false)}
        onDiscard={() => {
          setDiscard(false);
          void session.discard();
        }}
      />
    </View>
  );
}

function PendingSessionState({ onDiscard }: Readonly<{ onDiscard: () => void }>) {
  const session = useSession();
  const p = usePalette();
  const es = useLanguage() === 'es';
  if (!session.storageError) return <Loading />;
  return (
    <View style={ui.content}>
      <Text accessibilityRole="alert" style={{ color: p.danger }}>
        {session.error}
      </Text>
      <Button
        title={getTranslation(es ? 'es' : 'en')('training.retryStorage_13babc')}
        onPress={() => void session.retryStorage()}
        secondary
      />
      <Button
        title={getTranslation(es ? 'es' : 'en')('training.discardStoredWorkout_8ad6fd')}
        onPress={onDiscard}
        tone="danger"
      />
    </View>
  );
}

function StorageErrorState() {
  const session = useSession();
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <View style={ui.content}>
      <Text accessibilityRole="alert" style={{ color: p.danger }}>
        {session.error}
      </Text>
      <Button
        title={getTranslation(es ? 'es' : 'en')('training.retryStorage_13babc')}
        onPress={() => {
          void session.retryStorage();
        }}
        secondary
      />
    </View>
  );
}

function MinimizedWorkoutCard({
  inFlow,
  onDiscard,
}: Readonly<{ inFlow: boolean; onDiscard: () => void }>) {
  const session = useSession();
  const p = usePalette();
  const es = useLanguage() === 'es';
  const draft = session.draft;
  if (!draft) return null;
  return (
    <SafeAreaView
      pointerEvents="box-none"
      edges={['bottom']}
      style={
        inFlow
          ? { paddingHorizontal: spacing['space-4'], paddingBottom: spacing['space-4'] }
          : {
              position: 'absolute',
              bottom: spacing['space-4'],
              left: spacing['space-4'],
              right: spacing['space-4'],
              maxWidth: 640,
              alignSelf: 'center',
              zIndex: 10,
            }
      }
    >
      <View
        testID="ongoing-workout-card"
        style={[
          {
            borderRadius: radii['radius-lg'],
            gap: spacing['space-3'],
            padding: spacing['space-3'],
            borderWidth: 1,
            borderColor: p.brand,
            backgroundColor: p['surface-overlay'],
          },
          inFlow && { width: '100%', maxWidth: 640, alignSelf: 'center' },
        ]}
      >
        <View style={ui.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={getTranslation(es ? 'es' : 'en')(
              'training.ongoingWorkoutOptions_33fd0e',
            )}
            accessibilityHint={getTranslation(es ? 'es' : 'en')(
              'training.opensTheDiscardWorkoutConfirmation_402f0e',
            )}
            disabled={session.pending}
            onPress={onDiscard}
            style={{
              flex: 1,
              minHeight: 44,
              justifyContent: 'center',
              gap: spacing['space-1'],
            }}
          >
            <Text numberOfLines={1} style={{ color: p['overlay-ink'] }}>
              {getTranslation(es ? 'es' : 'en')('training.workoutOngoing_cf2159')}
            </Text>
            <WorkoutTimer
              compact
              onOverlay
              startedAt={draft.startedAt}
              endedAt={draft.frozen?.ended_at}
            />
          </Pressable>
          <IconButton
            icon="play"
            onOverlay
            label={getTranslation(es ? 'es' : 'en')('training.resumeWorkout_56d326')}
            bare
            disabled={session.pending}
            onPress={() => session.change((value) => ({ ...value, minimized: false }))}
          />
        </View>
        {session.error ? (
          <Text accessibilityRole="alert" style={{ color: p['overlay-ink'] }}>
            {session.error}
          </Text>
        ) : null}
        {session.storageError ? (
          <Button
            title={getTranslation(es ? 'es' : 'en')('training.retryStorage_13babc')}
            onPress={() => {
              void session.retryStorage();
            }}
            secondary
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function DiscardConfirmation({
  visible,
  onCancel,
  onDiscard,
}: Readonly<{ visible: boolean; onCancel: () => void; onDiscard: () => void }>) {
  const session = useSession();
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
          backgroundColor: p.scrim,
        }}
      >
        <View
          accessibilityViewIsModal
          style={[ui.card, { backgroundColor: p['surface-200'], width: '100%', maxWidth: 420 }]}
        >
          <Text accessibilityRole="alert" style={[ui.heading, { color: p.ink }]}>
            {session.draft
              ? getTranslation(es ? 'es' : 'en')('training.discardThisWorkout_a7a3ef')
              : getTranslation(es ? 'es' : 'en')('training.discardStoredWorkout_65ff6d')}
          </Text>
          <Text style={{ color: p['ink-muted'] }}>
            {session.draft?.frozen
              ? getTranslation(es ? 'es' : 'en')(
                  'training.finishDeliveryIsPendingResumeTheWorkout_fd46a7',
                )
              : getTranslation(es ? 'es' : 'en')(
                  'training.theWorkoutDraftAndItsSavedResults_0faabd',
                )}
          </Text>
          <Button
            title={getTranslation(es ? 'es' : 'en')('training.cancel_a25d0b')}
            secondary
            onPress={onCancel}
          />
          <Button
            title={getTranslation(es ? 'es' : 'en')('training.discard_671592')}
            disabled={session.pending || Boolean(session.draft?.frozen)}
            tone="danger"
            onPress={onDiscard}
          />
        </View>
      </View>
    </Modal>
  );
}
