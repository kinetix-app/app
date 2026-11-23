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
  const p = usePalette();
  const cache = useQueryClient();
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const name = personName(person.display_name);

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
      setError('Could not update this friendship. Try again.');
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
              Remove {name}?
            </Text>
            <Text style={{ color: p['ink-muted'] }}>
              You will stop seeing each other’s friends-only posts. You can add each other again
              later.
            </Text>
            {error ? (
              <Text accessibilityRole="alert" style={{ color: p.danger }}>
                {error}
              </Text>
            ) : null}
            <Button
              title="Cancel"
              secondary
              disabled={busy}
              onPress={() => setConfirmRemove(false)}
            />
            <Button
              title={pending === 'remove' ? 'Removing…' : 'Remove'}
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
  const p = usePalette();
  const busy = pending !== null;
  if (relationship === 'none')
    return (
      <Button
        title={pending === 'request' ? 'Sending…' : 'Add friend'}
        accessibilityLabel={`Add ${name} as a friend`}
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
            Request sent · waiting for {name}
          </Text>
        ) : null}
        <Button
          title={pending === 'remove' ? 'Cancelling…' : 'Cancel request'}
          accessibilityLabel={`Cancel friend request to ${name}`}
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
          title={pending === 'accept' ? 'Accepting…' : 'Accept'}
          accessibilityLabel={`Accept friend request from ${name}`}
          disabled={busy}
          onPress={() => onRun('accept')}
        />
        <Button
          title={pending === 'remove' ? 'Declining…' : 'Decline'}
          accessibilityLabel={`Decline friend request from ${name}`}
          secondary
          disabled={busy}
          onPress={() => onRun('remove')}
        />
      </>
    );
  return (
    <>
      {!compact ? (
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>You are friends</Text>
      ) : null}
      <Button
        title="Remove friend"
        accessibilityLabel={`Remove ${name} from friends`}
        tone="danger"
        disabled={busy}
        onPress={onRemove}
      />
    </>
  );
}
