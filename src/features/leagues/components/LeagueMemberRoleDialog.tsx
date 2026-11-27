import { getTranslation } from '@/i18n/catalog';
import { useLanguage } from '@/i18n/Language';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, shadows, spacing, textStyles, usePalette } from '@/theme/tokens';
import { LeagueAction, leagueStyles } from './LeagueUI';

function roleDescription(name: string, promoting: boolean, language: 'en' | 'es') {
  if (promoting) return getTranslation(language)('leagues.willBeAbleToEditTheLeague', { name });
  return getTranslation(language)('leagues.willKeepTheirMembershipAndScoresAdmin', { name });
}

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
  const language = useLanguage();

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

  const actionLabel = promoting
    ? getTranslation(language)('socialAdditional.makeAdmin_51fc5d')
    : getTranslation(language)('socialAdditional.makeMember_81600a');
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
                {getTranslation(language)('socialAdditional.changeMemberRole_91137c')}
              </Text>
            </View>
            <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
              {roleDescription(name, promoting, language)}
            </Text>
            {error ? (
              <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
                {getTranslation(language)('socialAdditional.couldNotChangeThisRolePlease_772cd7')}
              </Text>
            ) : null}
            <LeagueAction
              label={
                busy ? getTranslation(language)('socialAdditional.saving_444c23') : actionLabel
              }
              disabled={busy}
              variant="primary"
              onPress={() => {
                void confirm();
              }}
            />
            <LeagueAction
              label={getTranslation(language)('socialAdditional.cancel_a25d0b')}
              disabled={busy}
              onPress={close}
            />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
