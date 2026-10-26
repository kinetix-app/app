import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { ScreenHeader, screenContentStyle } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { trainingApi } from '../api';
import { useSession } from './SessionProvider';
import { WorkoutHistory } from './WorkoutHistory';
import { RoutineEditor } from './RoutineEditor';
import type { Routine } from '../schemas';
import { Button, Failure, IconButton, Loading, ui } from './ui';

export function TrainingWorkspace({
  accountId,
  showStartAction = true,
}: {
  accountId: number;
  showStartAction?: boolean;
}) {
  const p = usePalette();
  const session = useSession();
  const [history, setHistory] = useState(false);
  const cache = useQueryClient();
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [starting, setStarting] = useState<number | null>(null);
  const [startFailure, setStartFailure] = useState<{ id: number; error: unknown } | null>(null);
  const startPending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function startRoutine(id: number) {
    if (!session.ready || session.draft || startPending.current || session.storageError) return;
    setStartFailure(null);
    startPending.current = true;
    setStarting(id);
    try {
      const routine = await cache.fetchQuery({
        queryKey: ['training', accountId, 'routine', id, 'kg'],
        queryFn: ({ signal }) => trainingApi.routine(id, signal),
        staleTime: 0,
        retry: false,
      });
      if (alive.current) session.start(routine);
    } catch (error) {
      if (alive.current) setStartFailure({ id, error });
    } finally {
      startPending.current = false;
      if (alive.current) setStarting(null);
    }
  }
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
    queryKey: ['training', accountId, 'routine', editing, 'kg'],
    enabled: typeof editing === 'number',
    queryFn: ({ signal }) => trainingApi.routine(typeof editing === 'number' ? editing : 0, signal),
  });
  function onSaved(result: Routine) {
    cache.setQueryData(['training', accountId, 'routine', result.id, 'kg'], result);
    void cache.invalidateQueries({
      queryKey: ['training', accountId, 'routines'],
    });
    setEditing(null);
    setSaved(true);
  }
  if (history) return <WorkoutHistory accountId={accountId} onClose={() => setHistory(false)} />;
  if (editing === 'new' || (typeof editing === 'number' && detail.data)) {
    return (
      <RoutineEditor
        key={editing}
        accountId={accountId}
        routine={editing === 'new' ? undefined : detail.data}
        onSaved={onSaved}
        canStart={session.ready && !session.storageError && !session.draft}
        onStart={(result) => {
          onSaved(result);
          session.start(result);
        }}
        onClose={() => setEditing(null)}
      />
    );
  }
  return (
    <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
      <FlatList
        contentContainerStyle={[ui.content, screenContentStyle]}
        data={list.data?.pages.flatMap((page) => page.items) ?? []}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View style={ui.gap}>
            <ScreenHeader title="Routines">
              <Button
                title="Sign out"
                onPress={() => {
                  void session.signOut();
                }}
                secondary
              />
            </ScreenHeader>

            {showStartAction ? (
              <Button
                title="Start workout"
                onPress={() => session.start()}
                disabled={!session.ready || session.storageError || Boolean(session.draft)}
              />
            ) : null}
            <Button title="History" onPress={() => setHistory(true)} secondary />
            <TextField
              accessibilityLabel="Search routines"
              placeholder="Search by name"
              maxLength={150}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => setName(search.trim())}
            />
            <Button
              title="New routine"
              tone="positive"
              onPress={() => {
                setSaved(false);
                setEditing('new');
              }}
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
          <View
            style={[
              ui.card,
              { backgroundColor: p['surface-200'], marginBottom: spacing['space-2'] },
            ]}
          >
            <View style={ui.row}>
              <View
                style={{
                  padding: spacing['space-3'],
                  borderRadius: radii['radius-md'],
                  backgroundColor: p['surface-300'],
                }}
              >
                <Feather name="activity" size={24} color={p['brand-ink']} />
              </View>
              <Text style={[textStyles['title-md'], { flex: 1, color: p.ink }]}>{item.name}</Text>
            </View>
            <View style={[ui.row, { flexWrap: 'wrap' }]}>
              <View style={{ flexGrow: 1, flexBasis: 100 }}>
                <Button
                  title="Edit"
                  accessibilityLabel={`Edit ${item.name}`}
                  secondary
                  onPress={() => {
                    setSaved(false);
                    setEditing(item.id);
                  }}
                />
              </View>
              <View style={{ flexGrow: 1, flexBasis: 100 }}>
                <Button
                  title={starting === item.id ? 'Starting…' : 'Start'}
                  accessibilityLabel={`Start ${item.name}`}
                  disabled={
                    !session.ready ||
                    session.storageError ||
                    Boolean(session.draft) ||
                    starting !== null
                  }
                  onPress={() => {
                    void startRoutine(item.id);
                  }}
                />
              </View>
            </View>
            {startFailure?.id === item.id ? (
              <Failure
                error={startFailure.error}
                retry={() => {
                  void startRoutine(item.id);
                }}
              />
            ) : null}
          </View>
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
