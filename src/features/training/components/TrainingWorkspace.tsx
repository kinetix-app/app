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
import type { Routine, RoutineSummary } from '../schemas';
import { Button, Failure, IconButton, Loading, ui } from './ui';

export function TrainingWorkspace({
  accountId,
  showStartAction = true,
}: Readonly<{
  accountId: number;
  showStartAction?: boolean;
}>) {
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
      const routine = await cache.query({
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
          <RoutineListHeader
            showStartAction={showStartAction}
            search={search}
            onSearchChange={setSearch}
            onSearchSubmit={() => setName(search.trim())}
            onHistory={() => setHistory(true)}
            onNewRoutine={() => {
              setSaved(false);
              setEditing('new');
            }}
            saved={saved}
            listPending={list.isPending}
            listError={list.isError ? list.error : null}
            onRetryList={() => void list.refetch()}
            editing={editing}
            detailPending={detail.isPending}
            detailError={detail.isError ? detail.error : null}
            onRetryDetail={() => void detail.refetch()}
            onBackToRoutines={() => setEditing(null)}
          />
        }
        ListEmptyComponent={
          <EmptyRoutineState visible={!list.isPending && !list.isError} name={name} />
        }
        renderItem={({ item }) => (
          <RoutineRow
            item={item}
            starting={starting === item.id}
            canStart={session.ready && !session.storageError && !session.draft && starting === null}
            failure={startFailure?.id === item.id ? startFailure.error : undefined}
            onEdit={() => {
              setSaved(false);
              setEditing(item.id);
            }}
            onStart={() => void startRoutine(item.id)}
            onRetry={() => void startRoutine(item.id)}
          />
        )}
        refreshing={list.isRefetching && !list.isFetchingNextPage}
        onRefresh={() => {
          void list.refetch();
        }}
        ListFooterComponent={
          <RoutineListFooter
            visible={Boolean(list.hasNextPage)}
            loading={list.isFetchingNextPage}
            onMore={() => void list.fetchNextPage()}
          />
        }
      />
    </SafeAreaView>
  );
}

type RoutineListHeaderProps = Readonly<{
  showStartAction: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onHistory: () => void;
  onNewRoutine: () => void;
  saved: boolean;
  listPending: boolean;
  listError: Error | null;
  onRetryList: () => void;
  editing: number | 'new' | null;
  detailPending: boolean;
  detailError: Error | null;
  onRetryDetail: () => void;
  onBackToRoutines: () => void;
}>;

function RoutineListHeader({
  showStartAction,
  search,
  onSearchChange,
  onSearchSubmit,
  onHistory,
  onNewRoutine,
  saved,
  listPending,
  listError,
  onRetryList,
  editing,
  detailPending,
  detailError,
  onRetryDetail,
  onBackToRoutines,
}: RoutineListHeaderProps) {
  const p = usePalette();
  const session = useSession();
  const editingRoutine = typeof editing === 'number';
  return (
    <View style={ui.gap}>
      <ScreenHeader title="Routines">
        <Button title="Sign out" onPress={() => void session.signOut()} secondary />
      </ScreenHeader>
      {showStartAction ? (
        <Button
          title="Start workout"
          onPress={() => session.start()}
          disabled={!session.ready || session.storageError || Boolean(session.draft)}
        />
      ) : null}
      <Button title="History" onPress={onHistory} secondary />
      <TextField
        accessibilityLabel="Search routines"
        placeholder="Search by name"
        maxLength={150}
        value={search}
        onChangeText={onSearchChange}
        onSubmitEditing={onSearchSubmit}
      />
      <Button title="New routine" tone="positive" onPress={onNewRoutine} />
      {saved ? (
        <Text accessibilityRole="alert" style={{ color: p.success }}>
          Routine saved.
        </Text>
      ) : null}
      {listPending || (editingRoutine && detailPending) ? <Loading /> : null}
      {listError ? <Failure error={listError} retry={onRetryList} /> : null}
      {editingRoutine && detailError ? (
        <View style={ui.gap}>
          <Failure error={detailError} retry={onRetryDetail} />
          <IconButton icon="arrow-left" label="Back to routines" onPress={onBackToRoutines} />
        </View>
      ) : null}
    </View>
  );
}

function EmptyRoutineState({ visible, name }: Readonly<{ visible: boolean; name: string }>) {
  const p = usePalette();
  if (!visible) return null;
  return (
    <View style={[ui.card, { backgroundColor: p['surface-200'] }]}>
      <Text style={[ui.heading, { color: p.ink }]}>Your next workout starts here.</Text>
      <Text style={{ color: p['ink-muted'] }}>
        {name
          ? 'No routines match this name.'
          : 'Create a routine, choose exercises and plan your sets.'}
      </Text>
    </View>
  );
}

function RoutineRow({
  item,
  starting,
  canStart,
  failure,
  onEdit,
  onStart,
  onRetry,
}: Readonly<{
  item: RoutineSummary;
  starting: boolean;
  canStart: boolean;
  failure?: unknown;
  onEdit: () => void;
  onStart: () => void;
  onRetry: () => void;
}>) {
  const p = usePalette();
  return (
    <View
      style={[ui.card, { backgroundColor: p['surface-200'], marginBottom: spacing['space-2'] }]}
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
            onPress={onEdit}
          />
        </View>
        <View style={{ flexGrow: 1, flexBasis: 100 }}>
          <Button
            title={starting ? 'Starting…' : 'Start'}
            accessibilityLabel={`Start ${item.name}`}
            disabled={!canStart}
            onPress={onStart}
          />
        </View>
      </View>
      {failure !== undefined ? <Failure error={failure} retry={onRetry} /> : null}
    </View>
  );
}

function RoutineListFooter({
  visible,
  loading,
  onMore,
}: Readonly<{ visible: boolean; loading: boolean; onMore: () => void }>) {
  if (!visible) return null;
  return (
    <Button title={loading ? 'Loading…' : 'More'} disabled={loading} onPress={onMore} secondary />
  );
}
