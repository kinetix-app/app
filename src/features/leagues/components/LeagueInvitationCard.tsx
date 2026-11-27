import { getTranslation } from '@/i18n/catalog';
import { useLanguage } from '@/i18n/Language';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, shadows, spacing, textStyles, usePalette } from '@/theme/tokens';
import type { InvitationPreview } from '../schemas';
import { LeagueAvatar } from './LeagueAvatar';
import { LeagueAction, LeagueIconButton } from './LeagueUI';

export function LeagueInvitationCard({
  accountId,
  token,
  invitation,
  loading,
  joining,
  error,
  retry,
  onJoin,
  onClose,
}: Readonly<{
  accountId: number;
  token: string;
  invitation?: InvitationPreview;
  loading: boolean;
  joining: boolean;
  error?: string;
  retry?: () => void;
  onJoin: () => void;
  onClose: () => void;
}>) {
  const language = useLanguage();

  const p = usePalette();
  const muted = p['ink-muted'];
  const close = () => {
    if (!joining) onClose();
  };
  const metadata = invitation
    ? [
        {
          icon: 'people-outline' as const,
          label: getTranslation(language)('socialAdditional.members_6fc6dd'),
          value: String(invitation.member_count),
        },
        {
          icon: 'calendar-outline' as const,
          label: getTranslation(language)('socialAdditional.created_915309'),
          value: new Date(invitation.created_at).toLocaleDateString(language, {
            dateStyle: 'medium',
            timeZone: invitation.timezone ?? 'UTC',
          }),
        },
      ]
    : [];

  const joinLabel = joining
    ? getTranslation(language)('socialAdditional.joining_bda079')
    : getTranslation(language)('socialAdditional.joinLeague_790f40');
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: spacing['space-4'] }}>
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          onPress={close}
          style={{ position: 'absolute', inset: 0, backgroundColor: p.scrim }}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 440,
            alignSelf: 'center',
            maxHeight: '100%',
            overflow: 'hidden',
            backgroundColor: p['surface-200'],
            borderRadius: radii['radius-xl'],
            borderWidth: 1,
            borderColor: p.line,
            boxShadow: shadows()['shadow-pop'],
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: spacing['space-3'],
              right: spacing['space-3'],
              zIndex: 1,
            }}
          >
            <LeagueIconButton
              label={getTranslation(language)('socialAdditional.closeInvitation_01bd3b')}
              icon="close"
              onPress={close}
              disabled={joining}
            />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: spacing['space-5'], gap: spacing['space-5'] }}
          >
            <View style={{ alignItems: 'center', gap: spacing['space-3'] }}>
              <View
                style={{
                  padding: spacing['space-1'],
                  borderRadius: radii['radius-pill'],
                  borderWidth: 1,
                  borderColor: p['line-strong'],
                }}
              >
                <LeagueAvatar
                  accountId={accountId}
                  invitationToken={invitation?.has_picture ? token : undefined}
                  name={
                    invitation?.name ?? getTranslation(language)('socialAdditional.league_5e61e1')
                  }
                  size={84}
                />
              </View>
              <Text style={[textStyles.overline, { color: p['brand-ink'] }]}>
                {getTranslation(language)('socialAdditional.leagueInvitation_4b6e14')}
              </Text>
              <Text
                accessibilityRole="header"
                style={[textStyles['display-lg'], { color: p.ink, textAlign: 'center' }]}
              >
                {invitation?.name ??
                  (loading
                    ? getTranslation(language)('socialAdditional.openingInvitation_25a5f4')
                    : getTranslation(language)('socialAdditional.invitationUnavailable_948182'))}
              </Text>
              {invitation ? (
                <Text style={[textStyles.body, { color: muted, textAlign: 'center' }]}>
                  {invitation.description ??
                    getTranslation(language)('socialAdditional.noDescriptionProvided_b82342')}
                </Text>
              ) : null}
            </View>
            {invitation ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-2'] }}>
                {metadata.map(({ icon, label, value }) => (
                  <View
                    key={label}
                    style={{
                      flexGrow: 1,
                      flexBasis: 112,
                      padding: spacing['space-3'],
                      gap: spacing['space-1'],
                      backgroundColor: p['surface-300'],
                      borderRadius: radii['radius-md'],
                    }}
                  >
                    <Ionicons name={icon} size={20} color={p['brand-ink']} />
                    <Text style={[textStyles['body-sm'], { color: muted }]}>{label}</Text>
                    <Text
                      style={[textStyles.label, { color: p.ink, fontVariant: ['tabular-nums'] }]}
                    >
                      {value}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {invitation?.already_member ? (
              <View
                accessibilityLiveRegion="polite"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing['space-2'],
                  padding: spacing['space-3'],
                  borderRadius: radii['radius-md'],
                  backgroundColor: p['brand-soft'],
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={22} color={p['brand-ink']} />
                <Text style={[textStyles.label, { flex: 1, color: p['brand-ink'] }]}>
                  {getTranslation(language)('socialAdditional.youReAlreadyAMemberOf_64d4a5')}
                </Text>
              </View>
            ) : null}
            {loading ? (
              <ActivityIndicator
                color={p.brand}
                accessibilityLabel={getTranslation(language)(
                  'socialAdditional.loadingInvitation_a631a7',
                )}
              />
            ) : null}
            {error ? (
              <Text
                accessibilityRole="alert"
                style={[textStyles['body-sm'], { color: p.danger, textAlign: 'center' }]}
              >
                {error}
              </Text>
            ) : null}
            <View style={{ gap: spacing['space-2'] }}>
              {invitation ? (
                <LeagueAction
                  label={
                    invitation.already_member
                      ? getTranslation(language)('socialAdditional.openLeague_6e0a88')
                      : joinLabel
                  }
                  variant="primary"
                  disabled={joining}
                  onPress={onJoin}
                />
              ) : null}
              {retry ? (
                <LeagueAction
                  label={getTranslation(language)('socialAdditional.retryInvitation_4bd02a')}
                  variant="primary"
                  onPress={retry}
                />
              ) : null}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
