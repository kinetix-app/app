import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { personName } from '@/components/InitialAvatar';
import { Button, IconButton, Loading, ui } from '@/features/training/components/ui';
import { ApiError } from '@/services/apiClient';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { friendsApi, friendsKey } from '../api';
import { FriendActions } from './FriendActions';
import { PersonAvatar } from './PersonAvatar';

/** Another person's card, opened from the feed or a friend list. */
export function PersonScreen({
  accountId,
  personId,
  fallbackName,
  onBack,
  backLabel = 'Back',
}: Readonly<{
  accountId: number;
  personId: number;
  fallbackName?: string | null;
  onBack: () => void;
  backLabel?: string;
}>) {
  const p = usePalette();
  const person = useQuery({
    queryKey: [...friendsKey(accountId), 'person', personId],
    queryFn: ({ signal }) => friendsApi.person(personId, signal),
  });
  const name = personName(person.data?.display_name ?? fallbackName ?? null);
  const missing = person.error instanceof ApiError && person.error.status === 404;
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[ui.screen, { backgroundColor: p['surface-100'] }]}
    >
      <ScrollView contentContainerStyle={ui.content}>
        <View style={ui.row}>
          <IconButton icon="arrow-left" label={backLabel} onPress={onBack} />
          <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
            Profile
          </Text>
        </View>
        <View style={{ alignItems: 'center', gap: spacing['space-2'] }}>
          <PersonAvatar
            accountId={accountId}
            person={person.data ?? { id: personId, display_name: fallbackName ?? null }}
            size={88}
          />
          <Text style={[textStyles['title-lg'], { color: p.ink, textAlign: 'center' }]}>
            {name}
          </Text>
          {person.data ? (
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              {person.data.friend_count === 1 ? '1 friend' : `${person.data.friend_count} friends`}
            </Text>
          ) : null}
        </View>
        {person.isPending ? <Loading /> : null}
        {person.isError ? (
          <View style={ui.gap}>
            <Text accessibilityRole="alert" style={{ color: p.danger }}>
              {missing ? 'This person is no longer available.' : 'Could not load this profile.'}
            </Text>
            {!missing ? (
              <Button title="Retry" secondary onPress={() => void person.refetch()} />
            ) : null}
          </View>
        ) : null}
        {person.data ? (
          person.data.relationship === 'self' ? (
            <Text style={[textStyles.body, { color: p['ink-muted'], textAlign: 'center' }]}>
              This is you.
            </Text>
          ) : (
            <FriendActions
              accountId={accountId}
              person={person.data}
              relationship={person.data.relationship}
            />
          )
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
