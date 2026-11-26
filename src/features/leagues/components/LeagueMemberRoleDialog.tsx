import { useLanguage } from '@/i18n/Language';
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
  const language = useLanguage();
  const t = (en: string, es: string) => (language === 'es' ? es : en);
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
    ? t('Make admin', 'Hacer administrador')
    : t('Make member', 'Hacer miembro');
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
                {t('Change member role', 'Cambiar rol del miembro')}
              </Text>
            </View>
            <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
              {promoting
                ? language === 'es'
                  ? `${name} podrá editar la liga, invitar a personas y gestionar los roles.`
                  : `${name} will be able to edit the league, invite people and manage member roles.`
                : language === 'es'
                  ? `${name} conservará su membresía y puntuaciones. Se eliminarán los controles de administrador.`
                  : `${name} will keep their membership and scores. Admin controls will be removed.`}
            </Text>
            {error ? (
              <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
                {t(
                  'Could not change this role. Please try again.',
                  'No se pudo cambiar este rol. Inténtalo de nuevo.',
                )}
              </Text>
            ) : null}
            <LeagueAction
              label={busy ? t('Saving…', 'Guardando…') : actionLabel}
              disabled={busy}
              variant="primary"
              onPress={() => {
                void confirm();
              }}
            />
            <LeagueAction label={t('Cancel', 'Cancelar')} disabled={busy} onPress={close} />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
