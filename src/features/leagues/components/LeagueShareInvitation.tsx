import { useLanguage } from '@/i18n/Language';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, shadows, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { LeagueAction, LeagueIconButton, leagueStyles } from './LeagueUI';

export function LeagueShareInvitation({
  link,
  onClose,
}: Readonly<{ link: string; onClose: () => void }>) {
  const language = useLanguage();
  const t = (en: string, es: string) => (language === 'es' ? es : en);
  const p = usePalette();
  const [copiedAt, setCopiedAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (copiedAt === null) return;
    const timer = setTimeout(() => setCopiedAt(null), 2400);
    return () => clearTimeout(timer);
  }, [copiedAt]);

  async function copy() {
    setError('');
    try {
      if (!(await Clipboard.setStringAsync(link)))
        throw new Error('Could not copy the invitation link');
      setCopiedAt(Date.now());
    } catch {
      setCopiedAt(null);
      setError(
        t(
          'Could not copy the link. Try again or use Share.',
          'No se pudo copiar el enlace. Inténtalo de nuevo o usa Compartir.',
        ),
      );
    }
  }

  async function share() {
    setError('');
    try {
      if (Platform.OS !== 'web') await Share.share({ message: link });
      else if (typeof navigator.share === 'function') await navigator.share({ url: link });
      else await copy();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setError(
        t(
          'Could not share the link. Tap it to copy.',
          'No se pudo compartir el enlace. Púlsalo para copiarlo.',
        ),
      );
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: spacing['space-4'] }}>
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          tabIndex={-1}
          onPress={onClose}
          style={{ position: 'absolute', inset: 0, backgroundColor: p.scrim }}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 440,
            alignSelf: 'center',
            maxHeight: '100%',
            borderRadius: radii['radius-xl'],
            borderWidth: 1,
            borderColor: p.line,
            backgroundColor: p['surface-200'],
            boxShadow: shadows()['shadow-pop'],
            overflow: 'hidden',
          }}
        >
          <ScrollView
            contentContainerStyle={{ padding: spacing['space-5'], gap: spacing['space-4'] }}
          >
            <View style={leagueStyles.row}>
              <Text
                accessibilityRole="header"
                style={[textStyles['title-lg'], { flex: 1, color: p.ink }]}
              >
                {t('Invitation link', 'Enlace de invitación')}
              </Text>
              <LeagueIconButton
                label={t('Close invitation link', 'Cerrar enlace de invitación')}
                icon="close"
                onPress={onClose}
              />
            </View>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              {t(
                'Anyone with the link can join for the next 48 hours.',
                'Cualquier persona con el enlace puede unirse durante las próximas 48 horas.',
              )}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Copy invitation link', 'Copiar enlace de invitación')}
              onPress={() => {
                void copy();
              }}
              style={({ pressed }) => [
                leagueStyles.row,
                {
                  minHeight: sizes['control-height'],
                  borderRadius: radii['radius-md'],
                  borderWidth: 1,
                  borderColor: p['line-strong'],
                  padding: spacing['space-3'],
                  backgroundColor: p['surface-300'],
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                numberOfLines={2}
                style={[textStyles['body-sm'], { flex: 1, minWidth: 0, width: 0, color: p.ink }]}
              >
                {link}
              </Text>
              <Ionicons name="copy-outline" size={20} color={p['brand-ink']} />
            </Pressable>
            {error ? (
              <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
                {error}
              </Text>
            ) : null}
            <LeagueAction
              label={t('Share invitation', 'Compartir invitación')}
              icon="share-outline"
              variant="primary"
              onPress={() => {
                void share();
              }}
            />
          </ScrollView>
        </View>
        {copiedAt !== null ? (
          <View
            accessibilityLiveRegion="polite"
            role="status"
            style={{
              position: 'absolute',
              bottom: spacing['space-8'],
              alignSelf: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing['space-2'],
              paddingHorizontal: spacing['space-4'],
              paddingVertical: spacing['space-3'],
              borderRadius: radii['radius-pill'],
              backgroundColor: p['brand-soft'],
              borderWidth: 1,
              borderColor: p['line-strong'],
            }}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={p['brand-ink']} />
            <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
              {t('Link copied', 'Enlace copiado')}
            </Text>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
