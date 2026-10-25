import React, { useEffect, useRef, useState } from 'react';
import { AppState, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
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
import { StatusBar } from 'expo-status-bar';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { NutritionDiaryScreen } from '@/features/nutrition/NutritionDiaryScreen';
import { NutritionGoalEditor } from '@/features/nutrition/NutritionGoalEditor';
import { trainingApi } from './api';
import { SessionProvider, useSession } from './components/SessionProvider';
import { WorkoutTimer } from './components/WorkoutEditor';
import { OngoingSession } from './components/OngoingSession';
import { WorkoutHistory } from './components/WorkoutHistory';
import { RoutineEditor } from './RoutineEditor';
import type { Routine } from './schemas';
import { Button, Failure, IconButton, Loading, ui } from './ui';

function Workspace({ accountId }: { accountId: number }) {
  const p = usePalette();
  const session = useSession();
  const [history, setHistory] = useState(false);
  const cache = useQueryClient();
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [showNutrition, setShowNutrition] = useState(false);
  const [showNutritionGoal, setShowNutritionGoal] = useState(false);
  const [returnToNutrition, setReturnToNutrition] = useState(false);
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
  if (showNutrition) {
    return (
      <NutritionDiaryScreen
        accountId={accountId}
        onBack={() => setShowNutrition(false)}
        onEditGoal={() => {
          setReturnToNutrition(true);
          setShowNutrition(false);
          setShowNutritionGoal(true);
        }}
      />
    );
  }
  if (showNutritionGoal) {
    return (
      <NutritionGoalEditor
        accountId={accountId}
        onClose={() => {
          setShowNutritionGoal(false);
          if (returnToNutrition) {
            setReturnToNutrition(false);
            setShowNutrition(true);
          }
        }}
      />
    );
  }
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
        contentContainerStyle={ui.content}
        data={list.data?.pages.flatMap((page) => page.items) ?? []}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View style={ui.gap}>
            <View style={ui.row}>
              <Text accessibilityRole="header" style={[ui.title, { flex: 1, color: p.ink }]}>
                Routines
              </Text>
              <Button
                title="Sign out"
                onPress={() => {
                  void session.signOut();
                }}
                secondary
              />
            </View>

            <Button
              title="Start workout"
              onPress={() => session.start()}
              disabled={!session.ready || session.storageError || Boolean(session.draft)}
            />
            <Button title="History" onPress={() => setHistory(true)} secondary />
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
                {
                  color: p.ink,
                  borderColor: p['line-strong'],
                  backgroundColor: p['surface-300'],
                },
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
              onPress={() => setShowNutrition(true)}
            />
            <Button
              title="Temp button for nutrition goal"
              secondary
              onPress={() => {
                setReturnToNutrition(false);
                setShowNutritionGoal(true);
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
      <SessionProvider accountId={props.accountId} onSignOut={props.onSignOut}>
        <SessionHost>
          <Workspace accountId={props.accountId} />
        </SessionHost>
      </SessionProvider>
    </QueryClientProvider>
  );
}

function SessionHost({ children }: React.PropsWithChildren) {
  const session = useSession();
  const p = usePalette();
  const [discard, setDiscard] = useState(false);
  return (
    <View style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
      <View
        style={[ui.screen, { paddingBottom: session.draft?.minimized ? 112 : 0 }]}
        aria-hidden={discard || Boolean(session.draft && !session.draft.minimized)}
        accessibilityElementsHidden={discard || Boolean(session.draft && !session.draft.minimized)}
        importantForAccessibility={
          discard || (session.draft && !session.draft.minimized) ? 'no-hide-descendants' : 'auto'
        }
      >
        {children}
        {!session.ready ? (
          session.storageError ? (
            <View style={ui.content}>
              <Text accessibilityRole="alert" style={{ color: p.danger }}>
                {session.error}
              </Text>
              <Button
                title="Retry storage"
                onPress={() => {
                  void session.retryStorage();
                }}
                secondary
              />
              <Button
                title="Discard stored workout"
                onPress={() => setDiscard(true)}
                tone="danger"
              />
            </View>
          ) : (
            <Loading />
          )
        ) : null}
        {session.ready && session.storageError && !session.draft ? (
          <View style={ui.content}>
            <Text accessibilityRole="alert" style={{ color: p.danger }}>
              {session.error}
            </Text>
            <Button
              title="Retry storage"
              onPress={() => {
                void session.retryStorage();
              }}
              secondary
            />
          </View>
        ) : null}
      </View>
      {session.draft?.minimized && !discard ? (
        <SafeAreaView
          pointerEvents="box-none"
          edges={['bottom']}
          style={{
            position: 'absolute',
            bottom: spacing['space-4'],
            left: spacing['space-4'],
            right: spacing['space-4'],
            maxWidth: 640,
            alignSelf: 'center',
            zIndex: 10,
          }}
        >
          <View
            testID="ongoing-workout-card"
            style={[
              ui.card,
              {
                padding: spacing['space-3'],
                borderWidth: 1,
                borderColor: p.brand,
                backgroundColor: p.brand,
                elevation: 8,
                boxShadow: `0px 4px 16px ${p.scrim}`,
              },
            ]}
          >
            <View style={ui.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ongoing workout options"
                accessibilityHint="Opens the discard workout confirmation"
                disabled={session.pending}
                onPress={() => setDiscard(true)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  justifyContent: 'center',
                  gap: spacing['space-1'],
                }}
              >
                <Text numberOfLines={1} style={{ color: p['on-brand'] }}>
                  Workout ongoing
                </Text>
                <WorkoutTimer
                  compact
                  onPrimary
                  startedAt={session.draft.startedAt}
                  endedAt={session.draft.frozen?.ended_at}
                />
              </Pressable>
              <IconButton
                icon="play"
                onPrimary
                label="Resume workout"
                disabled={session.pending}
                onPress={() => session.change((value) => ({ ...value, minimized: false }))}
              />
            </View>
            {session.error ? (
              <Text accessibilityRole="alert" style={{ color: p['on-brand'] }}>
                {session.error}
              </Text>
            ) : null}
            {session.storageError ? (
              <Button
                title="Retry storage"
                onPress={() => {
                  void session.retryStorage();
                }}
                secondary
              />
            ) : null}
          </View>
        </SafeAreaView>
      ) : null}
      <Modal
        visible={Boolean(session.draft && !session.draft.minimized)}
        animationType="slide"
        onRequestClose={() => session.change((value) => ({ ...value, minimized: true }))}
      >
        {session.draft ? <OngoingSession /> : null}
      </Modal>
      <Modal
        visible={discard}
        transparent
        animationType="fade"
        onRequestClose={() => setDiscard(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
            backgroundColor: p.scrim,
          }}
        >
          <View
            accessibilityViewIsModal
            style={[ui.card, { backgroundColor: p['surface-200'], width: '100%', maxWidth: 420 }]}
          >
            <Text accessibilityRole="alert" style={[ui.heading, { color: p.ink }]}>
              {session.draft ? 'Discard this workout?' : 'Discard stored workout?'}
            </Text>
            <Text style={{ color: p['ink-muted'] }}>
              {session.draft?.frozen
                ? 'Finish delivery is pending. Resume the workout to retry Finish.'
                : 'The workout draft and its saved results will be removed.'}
            </Text>
            <Button title="Cancel" secondary onPress={() => setDiscard(false)} />
            <Button
              title="Discard"
              disabled={session.pending || Boolean(session.draft?.frozen)}
              tone="danger"
              onPress={() => {
                setDiscard(false);
                void session.discard();
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Private queries and draft forms are discarded when the account/session unmounts. */
export function TrainingWorkspace(props: { accountId: number; onSignOut: () => void }) {
  return <PrivateWorkspace key={props.accountId} {...props} />;
}
