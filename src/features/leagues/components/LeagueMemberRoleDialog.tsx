import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, shadows, spacing, textStyles, usePalette } from '@/theme/tokens';
import { LeagueAction, leagueStyles } from './LeagueUI';

export function LeagueMemberRoleDialog({
  name,
  nextRole,
  onConfirm,
  onCancel,
}: Readonly<{
  name: string;
  nextRole: 'admin' | 'member';
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}>) {
  const p = usePalette();
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const promoting = nextRole === 'admin';

  function close() {
    if (!submitting.current) onCancel();
  }

  async function confirm() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(false);
    try {
      await onConfirm();
      onCancel();
    } catch {
      setError(true);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const actionLabel = promoting ? 'Make admin' : 'Make member';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: spacing['space-4'] }}>
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          tabIndex={-1}
          onPress={close}
          style={{ position: 'absolute', inset: 0, backgroundColor: p.scrim }}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 440,
            maxHeight: '100%',
            alignSelf: 'center',
            borderRadius: radii['radius-xl'],
            borderWidth: 1,
            borderColor: p.line,
            backgroundColor: p['surface-200'],
            overflow: 'hidden',
            boxShadow: shadows()['shadow-pop'],
          }}
        >
          <ScrollView
            contentContainerStyle={{ padding: spacing['space-5'], gap: spacing['space-4'] }}
          >
            <View style={leagueStyles.row}>
              <Ionicons name="shield-outline" size={24} color={p['brand-ink']} />
              <Text
                accessibilityRole="header"
                style={[textStyles['title-md'], { flex: 1, color: p.ink }]}
              >
                Change member role
              </Text>
            </View>
            <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
              {promoting
                ? `${name} will be able to edit the league, invite people and manage member roles.`
                : `${name} will keep their membership and scores. Admin controls will be removed.`}
            </Text>
            {error ? (
              <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
                Could not change this role. Please try again.
              </Text>
            ) : null}
            <LeagueAction
              label={busy ? 'Saving…' : actionLabel}
              disabled={busy}
              variant="primary"
              onPress={() => {
                void confirm();
              }}
            />
            <LeagueAction label="Cancel" disabled={busy} onPress={close} />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
