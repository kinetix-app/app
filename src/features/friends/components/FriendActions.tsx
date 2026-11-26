import { useLanguage } from '@/i18n/Language';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { Button, ui } from '@/features/training/components/ui';
import { personName } from '@/components/InitialAvatar';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { friendsApi, friendsKey } from '../api';
import type { Person, Relationship } from '../schemas';

type Action = 'request' | 'accept' | 'remove';

/** Relationship-aware controls; the shown state always comes from the server. */
export function FriendActions({
  accountId,
  person,
  relationship,
  compact = false,
}: Readonly<{
  accountId: number;
  person: Person;
  relationship: Relationship;
  compact?: boolean;
}>) {
  const language = useLanguage();
  const p = usePalette();
  const cache = useQueryClient();
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const name = personName(person.display_name, language);

  async function run(action: Action) {
    if (pending) return;
    setPending(action);
    setError('');
    try {
      if (action === 'request') await friendsApi.request(person.id);
      else if (action === 'accept') await friendsApi.accept(person.id);
      else await friendsApi.remove(person.id);
      setConfirmRemove(false);
      // Friend lists, requests and the feed (friends-only posts) all depend on this.
      await Promise.all([
        cache.invalidateQueries({ queryKey: friendsKey(accountId) }),
        cache.invalidateQueries({ queryKey: ['feed', accountId, 'posts'] }),
      ]);
    } catch {
      setError(
        language === 'es'
          ? 'No se pudo actualizar la amistad. Inténtalo de nuevo.'
          : 'Could not update this friendship. Try again.',
      );
    } finally {
      setPending(null);
    }
  }

  if (relationship === 'self') return null;
  const busy = pending !== null;
  return (
    <View style={{ gap: spacing['space-2'] }}>
      <View
        style={
          compact
            ? [ui.row, { flexWrap: 'wrap', justifyContent: 'flex-end' }]
            : { gap: spacing['space-2'] }
        }
      >
        <Controls
          relationship={relationship}
          name={name}
          pending={pending}
          compact={compact}
          onRun={(action) => void run(action)}
          onRemove={() => setConfirmRemove(true)}
        />
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: p.danger }}>
          {error}
        </Text>
      ) : null}
      <Modal
        visible={confirmRemove}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setConfirmRemove(false);
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing['space-6'],
            backgroundColor: p.scrim,
          }}
        >
          <View
            accessibilityViewIsModal
            style={[ui.card, { backgroundColor: p['surface-200'], width: '100%', maxWidth: 420 }]}
          >
            <Text accessibilityRole="alert" style={[ui.heading, { color: p.ink }]}>
              {language === 'es' ? `¿Eliminar a ${name}?` : `Remove ${name}?`}
            </Text>
            <Text style={{ color: p['ink-muted'] }}>
              {language === 'es'
                ? 'Dejaréis de ver las publicaciones para amigos del otro. Podéis volver a agregaros más adelante.'
                : 'You will stop seeing each other’s friends-only posts. You can add each other again later.'}
            </Text>
            {error ? (
              <Text accessibilityRole="alert" style={{ color: p.danger }}>
                {error}
              </Text>
            ) : null}
            <Button
              title={language === 'es' ? 'Cancelar' : 'Cancel'}
              secondary
              disabled={busy}
              onPress={() => setConfirmRemove(false)}
            />
            <Button
              title={
                pending === 'remove'
                  ? language === 'es'
                    ? 'Eliminando…'
                    : 'Removing…'
                  : language === 'es'
                    ? 'Eliminar'
                    : 'Remove'
              }
              tone="danger"
              disabled={busy}
              onPress={() => void run('remove')}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Controls({
  relationship,
  name,
  pending,
  compact,
  onRun,
  onRemove,
}: Readonly<{
  relationship: Exclude<Relationship, 'self'>;
  name: string;
  pending: Action | null;
  compact: boolean;
  onRun: (action: Action) => void;
  onRemove: () => void;
}>) {
  const language = useLanguage();
  const p = usePalette();
  const busy = pending !== null;
  if (relationship === 'none')
    return (
      <Button
        title={
          pending === 'request'
            ? language === 'es'
              ? 'Enviando…'
              : 'Sending…'
            : language === 'es'
              ? 'Añadir amigo'
              : 'Add friend'
        }
        accessibilityLabel={
          language === 'es' ? `Añadir a ${name} como amigo` : `Add ${name} as a friend`
        }
        tone="positive"
        icon="user-plus"
        disabled={busy}
        onPress={() => onRun('request')}
      />
    );
  if (relationship === 'outgoing')
    return (
      <>
        {!compact ? (
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            {language === 'es'
              ? `Solicitud enviada · esperando a ${name}`
              : `Request sent · waiting for ${name}`}
          </Text>
        ) : null}
        <Button
          title={
            pending === 'remove'
              ? language === 'es'
                ? 'Cancelando…'
                : 'Cancelling…'
              : language === 'es'
                ? 'Cancelar solicitud'
                : 'Cancel request'
          }
          accessibilityLabel={
            language === 'es'
              ? `Cancelar solicitud de amistad a ${name}`
              : `Cancel friend request to ${name}`
          }
          secondary
          disabled={busy}
          onPress={() => onRun('remove')}
        />
      </>
    );
  if (relationship === 'incoming')
    return (
      <>
        <Button
          title={
            pending === 'accept'
              ? language === 'es'
                ? 'Aceptando…'
                : 'Accepting…'
              : language === 'es'
                ? 'Aceptar'
                : 'Accept'
          }
          accessibilityLabel={
            language === 'es'
              ? `Aceptar solicitud de amistad de ${name}`
              : `Accept friend request from ${name}`
          }
          disabled={busy}
          onPress={() => onRun('accept')}
        />
        <Button
          title={
            pending === 'remove'
              ? language === 'es'
                ? 'Rechazando…'
                : 'Declining…'
              : language === 'es'
                ? 'Rechazar'
                : 'Decline'
          }
          accessibilityLabel={
            language === 'es'
              ? `Rechazar solicitud de amistad de ${name}`
              : `Decline friend request from ${name}`
          }
          secondary
          disabled={busy}
          onPress={() => onRun('remove')}
        />
      </>
    );
  return (
    <>
      {!compact ? (
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {language === 'es' ? 'Sois amigos' : 'You are friends'}
        </Text>
      ) : null}
      <Button
        title={language === 'es' ? 'Eliminar amigo' : 'Remove friend'}
        accessibilityLabel={
          language === 'es' ? `Eliminar a ${name} de amigos` : `Remove ${name} from friends`
        }
        tone="danger"
        disabled={busy}
        onPress={onRemove}
      />
    </>
  );
}
