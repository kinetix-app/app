import React, { useEffect, useState } from 'react';
import { AppState, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useNetworkState } from 'expo-network';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { usePalette } from '@/theme/tokens';
import { trainingApi } from './api';
import { RoutineEditor } from './RoutineEditor';
import type { Routine } from './schemas';
import { Button, Failure, IconButton, Loading, ui } from './ui';

function Workspace({ accountId, onSignOut }: { accountId: number; onSignOut: () => void }) {
  const p = usePalette();
  const router = useRouter();
  const cache = useQueryClient();
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setName(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const list = useInfiniteQuery({
    queryKey: ['training', accountId, 'routines', name],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => trainingApi.routines(pageParam, signal, name),
    getNextPageParam: (page) =>
      page.items.length === page.limit ? page.offset + page.limit : undefined,
  });
  const detail = useQuery({
    queryKey: ['training', accountId, 'routine', editing],
    enabled: typeof editing === 'number',
    queryFn: ({ signal }) => trainingApi.routine(typeof editing === 'number' ? editing : 0, signal),
  });
  function onSaved(result: Routine) {
    cache.setQueryData(['training', accountId, 'routine', result.id], result);
    void cache.invalidateQueries({ queryKey: ['training', accountId, 'routines'] });
    setEditing(null);
    setSaved(true);
  }
  if (editing === 'new' || (typeof editing === 'number' && detail.data)) {
    return (
      <RoutineEditor
        key={editing}
        accountId={accountId}
        routine={editing === 'new' ? undefined : detail.data}
        onSaved={onSaved}
        onClose={() => setEditing(null)}
      />
    );
  }
  return (
    <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
      <FlatList
        contentContainerStyle={ui.content}
        data={list.data?.pages.flatMap((page) => page.items) ?? []}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View style={ui.gap}>
            <View style={ui.row}>
              <Text accessibilityRole="header" style={[ui.title, { flex: 1, color: p.ink }]}>
                Routines
              </Text>
              <Button title="Sign out" onPress={onSignOut} secondary />
            </View>

            <TextInput
              accessibilityLabel="Search routines"
              placeholder="Search by name"
              placeholderTextColor={p['ink-muted']}
              maxLength={150}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => setName(search.trim())}
              style={[
                ui.field,
                { color: p.ink, borderColor: p['line-strong'], backgroundColor: p['surface-300'] },
              ]}
            />
            <Button
              title="New routine"
              tone="positive"
              onPress={() => {
                setSaved(false);
                setEditing('new');
              }}
            />
            <Button
              title="Temp button for nutrition section"
              secondary
              onPress={() => router.push('/nutrition')}
            />
            {saved ? (
              <Text accessibilityRole="alert" style={{ color: p.success }}>
                Routine saved.
              </Text>
            ) : null}
            {list.isPending || (typeof editing === 'number' && detail.isPending) ? (
              <Loading />
            ) : null}
            {list.isError ? (
              <Failure
                error={list.error}
                retry={() => {
                  void list.refetch();
                }}
              />
            ) : null}
            {typeof editing === 'number' && detail.isError ? (
              <View style={ui.gap}>
                <Failure
                  error={detail.error}
                  retry={() => {
                    void detail.refetch();
                  }}
                />
                <IconButton
                  icon="arrow-left"
                  label="Back to routines"
                  onPress={() => setEditing(null)}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !list.isPending && !list.isError ? (
            <View style={[ui.card, { backgroundColor: p['surface-200'] }]}>
              <Text style={[ui.heading, { color: p.ink }]}>Your next workout starts here.</Text>
              <Text style={{ color: p['ink-muted'] }}>
                {name
                  ? 'No routines match this name.'
                  : 'Create a routine, choose exercises and plan your sets.'}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
            onPress={() => {
              setSaved(false);
              setEditing(item.id);
            }}
            style={[ui.card, ui.row, { backgroundColor: p['surface-200'], marginBottom: 8 }]}
          >
            <View style={{ padding: 12, borderRadius: 12, backgroundColor: p['surface-300'] }}>
              <Feather name="activity" size={24} color={p['brand-ink']} />
            </View>
            <Text style={[ui.heading, { flex: 1, color: p.ink }]}>{item.name}</Text>
            <Feather name="chevron-right" size={24} color={p['ink-muted']} />
          </Pressable>
        )}
        refreshing={list.isRefetching && !list.isFetchingNextPage}
        onRefresh={() => {
          void list.refetch();
        }}
        ListFooterComponent={
          list.hasNextPage ? (
            <Button
              title={list.isFetchingNextPage ? 'Loading…' : 'More'}
              disabled={list.isFetchingNextPage}
              onPress={() => {
                void list.fetchNextPage();
              }}
              secondary
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function PrivateWorkspace(props: { accountId: number; onSignOut: () => void }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30000, gcTime: 0 },
          mutations: { retry: false, gcTime: 0 },
        },
      }),
  );
  const network = useNetworkState();
  useEffect(() => {
    onlineManager.setOnline(network.isConnected !== false && network.isInternetReachable !== false);
  }, [network.isConnected, network.isInternetReachable]);
  useEffect(() => {
    focusManager.setFocused(
      ['background', 'inactive'].includes(AppState.currentState) ? false : undefined,
    );
    const subscription = AppState.addEventListener('change', (state) =>
      focusManager.setFocused(state === 'active'),
    );
    return () => {
      subscription.remove();
      void client.cancelQueries();
      client.clear();
    };
  }, [client]);
  return (
    <QueryClientProvider client={client}>
      <StatusBar style="auto" />
      <Workspace {...props} />
    </QueryClientProvider>
  );
}

/** Private queries and draft forms are discarded when the account/session unmounts. */
export function TrainingWorkspace(props: { accountId: number; onSignOut: () => void }) {
  return <PrivateWorkspace key={props.accountId} {...props} />;
}
