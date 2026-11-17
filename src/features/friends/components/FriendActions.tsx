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
  let controls: React.ReactNode;
  if (relationship === 'none')
    controls = (
      <Button
        title={pending === 'request' ? 'Sending…' : 'Add friend'}
        accessibilityLabel={`Add ${name} as a friend`}
        tone="positive"
        icon="user-plus"
        disabled={busy}
        onPress={() => void run('request')}
      />
    );
  else if (relationship === 'outgoing')
    controls = (
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
          onPress={() => void run('remove')}
        />
      </>
    );
  else if (relationship === 'incoming')
    controls = (
      <>
        <Button
          title={pending === 'accept' ? 'Accepting…' : 'Accept'}
          accessibilityLabel={`Accept friend request from ${name}`}
          disabled={busy}
          onPress={() => void run('accept')}
        />
        <Button
          title={pending === 'remove' ? 'Declining…' : 'Decline'}
          accessibilityLabel={`Decline friend request from ${name}`}
          secondary
          disabled={busy}
          onPress={() => void run('remove')}
        />
      </>
    );
  else
    controls = (
      <>
        {!compact ? (
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>You are friends</Text>
        ) : null}
        <Button
          title="Remove friend"
          accessibilityLabel={`Remove ${name} from friends`}
          tone="danger"
          disabled={busy}
          onPress={() => setConfirmRemove(true)}
        />
      </>
    );

  return (
    <View style={{ gap: spacing['space-2'] }}>
      <View
        style={
          compact
            ? [ui.row, { flexWrap: 'wrap', justifyContent: 'flex-end' }]
            : { gap: spacing['space-2'] }
        }
      >
        {controls}
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
        onRequestClose={() => !busy && setConfirmRemove(false)}
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
