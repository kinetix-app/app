import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { personName } from '@/components/InitialAvatar';
import { TextField } from '@/components/TextField';
import { Button, IconButton, Loading, ui } from '@/features/training/components/ui';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { friendsApi, friendsKey, requestsKey } from '../api';
import type { Person } from '../schemas';
import { FriendActions } from './FriendActions';
import { PersonAvatar } from './PersonAvatar';
import { PersonScreen } from './PersonScreen';

type Tab = 'friends' | 'requests' | 'find';

export function FriendsScreen({
  accountId,
  onClose,
  active = true,
  initialTab = 'friends',
}: Readonly<{ accountId: number; onClose: () => void; active?: boolean; initialTab?: Tab }>) {
  const p = usePalette();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [person, setPerson] = useState<Person | null>(null);
  const requests = useQuery({
    queryKey: requestsKey(accountId),
    queryFn: ({ signal }) => friendsApi.requests(signal),
  });
  const back = useCallback(() => {
    if (person) setPerson(null);
    else onClose();
    return true;
  }, [person, onClose]);
  useHardwareBack(back, active);
  if (person)
    return (
      <PersonScreen
        accountId={accountId}
        personId={person.id}
        fallbackName={person.display_name}
        onBack={() => setPerson(null)}
        backLabel="Back to friends"
      />
    );
  const incoming = requests.data?.incoming.length ?? 0;
  const tabs: { id: Tab; label: string }[] = [
    { id: 'friends', label: 'Friends' },
    { id: 'requests', label: incoming ? `Requests (${incoming})` : 'Requests' },
    { id: 'find', label: 'Find' },
  ];
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[ui.screen, { backgroundColor: p['surface-100'] }]}
    >
      <View style={[ui.content, { paddingBottom: 0, gap: spacing['space-4'] }]}>
        <View style={ui.row}>
          <IconButton icon="arrow-left" label="Back to profile" onPress={onClose} />
          <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
            Friends
          </Text>
        </View>
        <View
          accessibilityRole="tablist"
          style={[styles.tabs, { backgroundColor: p['surface-200'] }]}
        >
          {tabs.map((item) => {
            const selected = item.id === tab;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setTab(item.id)}
                style={[styles.tab, selected && { backgroundColor: p['brand-soft'] }]}
              >
                <Text
                  style={[textStyles.label, { color: selected ? p['brand-ink'] : p['ink-muted'] }]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {tab === 'friends' ? (
        <FriendList accountId={accountId} onOpen={setPerson} onFind={() => setTab('find')} />
      ) : null}
      {tab === 'requests' ? (
        <RequestList accountId={accountId} query={requests} onOpen={setPerson} />
      ) : null}
      {tab === 'find' ? <FindPeople accountId={accountId} onOpen={setPerson} /> : null}
    </SafeAreaView>
  );
}

function PersonRow({
  accountId,
  person,
  detail,
  onOpen,
  children,
}: React.PropsWithChildren<{
  accountId: number;
  person: Person;
  detail?: string;
  onOpen: (person: Person) => void;
}>) {
  const p = usePalette();
  const name = personName(person.display_name);
  return (
    <View style={[ui.card, { backgroundColor: p['surface-200'] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${name}’s profile`}
        onPress={() => onOpen(person)}
        style={({ pressed }) => [
          ui.row,
          { minHeight: sizes['tap-min'], opacity: pressed ? 0.65 : 1 },
        ]}
      >
        <PersonAvatar accountId={accountId} person={person} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[textStyles['title-md'], { color: p.ink }]}>
            {name}
          </Text>
          {detail ? (
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{detail}</Text>
          ) : null}
        </View>
      </Pressable>
      {children}
    </View>
  );
}

function FriendList({
  accountId,
  onOpen,
  onFind,
}: Readonly<{ accountId: number; onOpen: (person: Person) => void; onFind: () => void }>) {
  const p = usePalette();
  const list = useInfiniteQuery({
    queryKey: [...friendsKey(accountId), 'list'],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => friendsApi.friends(pageParam, signal),
    getNextPageParam: (page) =>
      page.items.length === page.limit ? page.offset + page.limit : undefined,
  });
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <FlatList
      contentContainerStyle={ui.content}
      data={items}
      keyExtractor={(item) => String(item.user.id)}
      ListHeaderComponent={
        <>
          {list.isPending ? <Loading /> : null}
          {list.isError ? (
            <Retry text="Could not load your friends." onRetry={() => void list.refetch()} />
          ) : null}
        </>
      }
      ListEmptyComponent={
        (list.data ? (
          <View style={[ui.card, { backgroundColor: p['surface-200'], alignItems: 'center' }]}>
            <Text style={[textStyles['title-md'], { color: p.ink }]}>No friends yet</Text>
            <Text style={{ color: p['ink-muted'], textAlign: 'center' }}>
              Find people by name or add someone from their post in the feed.
            </Text>
            <Button title="Find friends" tone="positive" icon="search" onPress={onFind} />
          </View>
        ) : null) ?? undefined
      }
      renderItem={({ item }) => (
        <PersonRow
          accountId={accountId}
          person={item.user}
          detail={`Friends since ${new Date(item.since).toLocaleDateString()}`}
          onOpen={onOpen}
        />
      )}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetching) void list.fetchNextPage({ cancelRefetch: false });
      }}
      ListFooterComponent={(list.isFetchingNextPage ? <Loading /> : null) ?? undefined}
    />
  );
}

function RequestList({
  accountId,
  query,
  onOpen,
}: Readonly<{
  accountId: number;
  query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof friendsApi.requests>>>>;
  onOpen: (person: Person) => void;
}>) {
  const p = usePalette();
  const data = query.data;
  const sections = [
    ...(data?.incoming.map((item) => ({ ...item, kind: 'incoming' as const })) ?? []),
    ...(data?.outgoing.map((item) => ({ ...item, kind: 'outgoing' as const })) ?? []),
  ];
  return (
    <FlatList
      contentContainerStyle={ui.content}
      data={sections}
      keyExtractor={(item) => `${item.kind}-${item.user.id}`}
      ListHeaderComponent={
        <>
          {query.isPending ? <Loading /> : null}
          {query.isError ? (
            <Retry text="Could not load friend requests." onRetry={() => void query.refetch()} />
          ) : null}
        </>
      }
      ListEmptyComponent={
        (data ? (
          <Text style={{ color: p['ink-muted'] }}>No pending friend requests.</Text>
        ) : null) ?? undefined
      }
      renderItem={({ item }) => (
        <PersonRow
          accountId={accountId}
          person={item.user}
          detail={item.kind === 'incoming' ? 'Wants to be your friend' : 'Request sent'}
          onOpen={onOpen}
        >
          <FriendActions
            accountId={accountId}
            person={item.user}
            relationship={item.kind}
            compact
          />
        </PersonRow>
      )}
    />
  );
}

function FindPeople({
  accountId,
  onOpen,
}: Readonly<{ accountId: number; onOpen: (person: Person) => void }>) {
  const p = usePalette();
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setTerm(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);
  const ready = term.length >= 2;
  const results = useQuery({
    queryKey: [...friendsKey(accountId), 'search', term],
    queryFn: ({ signal }) => friendsApi.search(term, signal),
    enabled: ready,
  });
  return (
    <FlatList
      contentContainerStyle={ui.content}
      keyboardShouldPersistTaps="handled"
      data={ready ? (results.data?.items ?? []) : []}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <View style={ui.gap}>
          <TextField
            accessibilityLabel="Search people by name"
            placeholder="Search by name"
            value={text}
            onChangeText={setText}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="search"
          />
          {!ready ? (
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              Type at least 2 letters of a name.
            </Text>
          ) : null}
          {ready && results.isPending ? <Loading /> : null}
          {results.isError ? (
            <Retry text="Could not search right now." onRetry={() => void results.refetch()} />
          ) : null}
        </View>
      }
      ListEmptyComponent={
        (ready && results.data ? (
          <Text style={{ color: p['ink-muted'] }}>No one found with that name.</Text>
        ) : null) ?? undefined
      }
      renderItem={({ item }) => (
        <PersonRow accountId={accountId} person={item} onOpen={onOpen}>
          <FriendActions
            accountId={accountId}
            person={item}
            relationship={item.relationship}
            compact
          />
        </PersonRow>
      )}
    />
  );
}

function Retry({ text, onRetry }: Readonly<{ text: string; onRetry: () => void }>) {
  const p = usePalette();
  return (
    <View style={ui.gap}>
      <Text accessibilityRole="alert" style={{ color: p.danger }}>
        {text}
      </Text>
      <Button title="Retry" secondary onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', borderRadius: radii['radius-pill'], padding: spacing['space-1'] },
  tab: {
    flex: 1,
    minHeight: sizes['tap-min'],
    borderRadius: radii['radius-pill'],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['space-2'],
  },
});
