import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, usePalette } from '@/theme/tokens';
import { useSession } from './SessionProvider';
import { WorkoutTimer } from './WorkoutEditor';
import { OngoingSession } from './OngoingSession';
import { Button, IconButton, Loading, ui } from './ui';

export function SessionHost({ children }: React.PropsWithChildren) {
  const session = useSession();
  const p = usePalette();
  const [discard, setDiscard] = useState(false);
  return (
    <View style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
      <View
        style={[ui.screen, { paddingBottom: session.draft?.minimized ? 112 : 0 }]}
        aria-hidden={discard || Boolean(session.draft && !session.draft.minimized)}
        accessibilityElementsHidden={discard || Boolean(session.draft && !session.draft.minimized)}
        importantForAccessibility={
          discard || (session.draft && !session.draft.minimized) ? 'no-hide-descendants' : 'auto'
        }
      >
        {children}
        {!session.ready ? (
          session.storageError ? (
            <View style={ui.content}>
              <Text accessibilityRole="alert" style={{ color: p.danger }}>
                {session.error}
              </Text>
              <Button
                title="Retry storage"
                onPress={() => {
                  void session.retryStorage();
                }}
                secondary
              />
              <Button
                title="Discard stored workout"
                onPress={() => setDiscard(true)}
                tone="danger"
              />
            </View>
          ) : (
            <Loading />
          )
        ) : null}
        {session.ready && session.storageError && !session.draft ? (
          <View style={ui.content}>
            <Text accessibilityRole="alert" style={{ color: p.danger }}>
              {session.error}
            </Text>
            <Button
              title="Retry storage"
              onPress={() => {
                void session.retryStorage();
              }}
              secondary
            />
          </View>
        ) : null}
      </View>
      {session.draft?.minimized && !discard ? (
        <SafeAreaView
          pointerEvents="box-none"
          edges={['bottom']}
          style={{
            position: 'absolute',
            bottom: spacing['space-4'],
            left: spacing['space-4'],
            right: spacing['space-4'],
            maxWidth: 640,
            alignSelf: 'center',
            zIndex: 10,
          }}
        >
          <View
            testID="ongoing-workout-card"
            style={[
              ui.card,
              {
                padding: spacing['space-3'],
                borderWidth: 1,
                borderColor: p.brand,
                backgroundColor: p['surface-overlay'],
                elevation: 8,
                boxShadow: `0px 4px 16px ${p.scrim}`,
              },
            ]}
          >
            <View style={ui.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ongoing workout options"
                accessibilityHint="Opens the discard workout confirmation"
                disabled={session.pending}
                onPress={() => setDiscard(true)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  justifyContent: 'center',
                  gap: spacing['space-1'],
                }}
              >
                <Text numberOfLines={1} style={{ color: p['overlay-ink'] }}>
                  Workout ongoing
                </Text>
                <WorkoutTimer
                  compact
                  onOverlay
                  startedAt={session.draft.startedAt}
                  endedAt={session.draft.frozen?.ended_at}
                />
              </Pressable>
              <IconButton
                icon="play"
                onOverlay
                label="Resume workout"
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
                title="Retry storage"
                onPress={() => {
                  void session.retryStorage();
                }}
                secondary
              />
            ) : null}
          </View>
        </SafeAreaView>
      ) : null}
      <Modal
        visible={Boolean(session.draft && !session.draft.minimized)}
        animationType="slide"
        onRequestClose={() => session.change((value) => ({ ...value, minimized: true }))}
      >
        {session.draft ? <OngoingSession /> : null}
      </Modal>
      <Modal
        visible={discard}
        transparent
        animationType="fade"
        onRequestClose={() => setDiscard(false)}
      >
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
              {session.draft ? 'Discard this workout?' : 'Discard stored workout?'}
            </Text>
            <Text style={{ color: p['ink-muted'] }}>
              {session.draft?.frozen
                ? 'Finish delivery is pending. Resume the workout to retry Finish.'
                : 'The workout draft and its saved results will be removed.'}
            </Text>
            <Button title="Cancel" secondary onPress={() => setDiscard(false)} />
            <Button
              title="Discard"
              disabled={session.pending || Boolean(session.draft?.frozen)}
              tone="danger"
              onPress={() => {
                setDiscard(false);
                void session.discard();
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
