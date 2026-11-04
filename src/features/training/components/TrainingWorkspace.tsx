import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { ScreenHeader, screenContentStyle } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { trainingApi } from '../api';
import { useSession } from './SessionProvider';
import { RoutineActionsMenu } from './RoutineActionsMenu';
import { RoutineCover } from './RoutineCover';
import type { ImagePickerAsset } from 'expo-image-picker';
import { pickRoutinePicture, routinePictureForm } from './routinePicture';
import { RoutineEditor } from './RoutineEditor';
import type { Routine, RoutineSummary } from '../schemas';
import { Button, Failure, IconButton, Loading, ui } from './ui';

export function TrainingWorkspace({
  accountId,
  onEditingChange,
}: Readonly<{
  accountId: number;
  onEditingChange?: (editing: boolean) => void;
}>) {
  const p = usePalette();
  const session = useSession();
  const cache = useQueryClient();
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  useEffect(() => {
    onEditingChange?.(editing !== null);
    return () => onEditingChange?.(false);
  }, [editing, onEditingChange]);
  const [actions, setActions] = useState<{
    item: RoutineSummary;
    restoreFocus: () => void;
  } | null>(null);
  function closeActions() {
    const restore = actions?.restoreFocus;
    setActions(null);
    if (restore) requestAnimationFrame(restore);
  }
  const coverBusy = useRef(false);
  const [coverWorking, setCoverWorking] = useState(false);
  const [coverError, setCoverError] = useState('');
  const [failedCover, setFailedCover] = useState<{ id: number; asset: ImagePickerAsset } | null>(
    null,
  );
  const coverMutation = useMutation({
    mutationFn: ({ id, asset }: { id: number; asset?: ImagePickerAsset }) =>
      asset
        ? trainingApi.uploadPicture(id, routinePictureForm(asset))
        : trainingApi.removePicture(id),
    retry: false,
    onSuccess: (result, { asset }) => {
      if (!alive.current) return;
      cache.setQueryData(['training', accountId, 'routine', result.id, 'kg'], result);
      cache.setQueriesData<InfiniteData<Awaited<ReturnType<typeof trainingApi.routines>>>>(
        { queryKey: ['training', accountId, 'routines'] },
        (current) =>
          current
            ? {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  items: page.items.map((item) =>
                    item.id === result.id ? { ...item, image_url: result.image_url } : item,
                  ),
                })),
              }
            : current,
      );
      void cache.invalidateQueries({ queryKey: ['training', accountId, 'routines'] });
      if (asset && actions?.item.id === result.id) closeActions();
      else
        setActions((current) =>
          current?.item.id === result.id
            ? { ...current, item: { ...current.item, image_url: result.image_url } }
            : current,
        );
      setFailedCover(null);
    },
  });
  async function manageCover(mode: 'choose' | 'remove' | 'retry') {
    if (coverBusy.current || !actions) return;
    coverBusy.current = true;
    setCoverWorking(true);
    setCoverError('');
    try {
      let asset: ImagePickerAsset | undefined;
      if (mode === 'choose') {
        const selected = await pickRoutinePicture();
        if (!alive.current || !selected) return;
        if ('error' in selected) {
          setCoverError(selected.error);
          return;
        }
        asset = selected.asset;
      } else if (mode === 'retry') {
        if (failedCover?.id !== actions.item.id) return;
        asset = failedCover.asset;
      }
      setFailedCover(asset ? { id: actions.item.id, asset } : null);
      await coverMutation.mutateAsync({ id: actions.item.id, asset });
    } catch {
      if (alive.current) setCoverError('Could not update the cover. Try again.');
    } finally {
      coverBusy.current = false;
      if (alive.current) setCoverWorking(false);
    }
  }
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(timer);
  }, [saved]);
  const removeRoutine = useMutation({
    mutationFn: (id: number) => trainingApi.removeRoutine(id),
    retry: false,
    onSuccess: async (_, id) => {
      cache.setQueriesData<InfiniteData<Awaited<ReturnType<typeof trainingApi.routines>>>>(
        { queryKey: ['training', accountId, 'routines'] },
        (current) =>
          current
            ? {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  items: page.items.filter((item) => item.id !== id),
                })),
              }
            : current,
      );
      setSaved(false);
      await cache.invalidateQueries({ queryKey: ['training', accountId, 'routines'] });
      cache.removeQueries({ queryKey: ['training', accountId, 'routine', id] });
      cache.removeQueries({ queryKey: ['training', accountId, 'routine-picture', id] });
      setActions(null);
    },
  });
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
        aria-hidden={Boolean(actions)}
        accessibilityElementsHidden={Boolean(actions)}
        importantForAccessibility={actions ? 'no-hide-descendants' : 'auto'}
        contentContainerStyle={[ui.content, screenContentStyle]}
        data={list.data?.pages.flatMap((page) => page.items) ?? []}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <RoutineListHeader
            search={search}
            onSearchChange={setSearch}
            onSearchSubmit={() => setName(search.trim())}
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
          <EmptyRoutineState
            visible={!list.isPending && !list.isError}
            name={name}
            onCreate={() => setEditing('new')}
          />
        }
        renderItem={({ item }) => (
          <RoutineRow
            accountId={accountId}
            item={item}
            starting={starting === item.id}
            failure={startFailure?.id === item.id ? startFailure.error : undefined}
            onEdit={() => {
              setSaved(false);
              setEditing(item.id);
            }}
            onActions={(restoreFocus) => {
              removeRoutine.reset();
              setCoverError('');
              setFailedCover(null);
              setActions({ item, restoreFocus });
            }}
            canStart={session.ready && !session.storageError && !session.draft && starting === null}
            onStart={() => void startRoutine(item.id)}
            actionsOpen={actions?.item.id === item.id}
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
      {actions ? (
        <RoutineActionsMenu
          name={actions.item.name}
          canStart={session.ready && !session.storageError && !session.draft && starting === null}
          startHint={
            session.draft
              ? 'Finish or discard your ongoing workout to start another.'
              : 'Workout starting is unavailable. Try again when synchronization finishes.'
          }
          canDelete={
            session.ready &&
            !session.storageError &&
            session.draft?.routineId !== actions.item.id &&
            starting === null
          }
          deleting={removeRoutine.isPending}
          deleteError={removeRoutine.isError ? removeRoutine.error : null}
          hasCover={Boolean(actions.item.image_url)}
          coverPending={coverWorking}
          coverError={coverError}
          onChooseCover={() => void manageCover('choose')}
          onRemoveCover={() => void manageCover('remove')}
          onRetryCover={failedCover ? () => void manageCover('retry') : undefined}
          onDelete={() => removeRoutine.mutate(actions.item.id)}
          onClose={closeActions}
          onEdit={() => {
            const id = actions.item.id;
            setActions(null);
            setSaved(false);
            setEditing(id);
          }}
          onStart={() => {
            const id = actions.item.id;
            closeActions();
            void startRoutine(id);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

type RoutineListHeaderProps = Readonly<{
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
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
  search,
  onSearchChange,
  onSearchSubmit,
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
  const editingRoutine = typeof editing === 'number';
  return (
    <View style={ui.gap}>
      <ScreenHeader title="Workouts">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New routine"
          onPress={onNewRoutine}
          style={({ pressed }) => [styles.create, { opacity: pressed ? 0.55 : 1 }]}
        >
          <Feather name="plus" size={24} color={p['brand-ink']} />
          <Text style={[textStyles.label, { color: p['brand-ink'] }]}>Routine</Text>
        </Pressable>
      </ScreenHeader>
      <TextField
        accessibilityLabel="Search routines"
        placeholder="Search by name"
        maxLength={150}
        value={search}
        onChangeText={onSearchChange}
        onSubmitEditing={onSearchSubmit}
      />
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

function EmptyRoutineState({
  visible,
  name,
  onCreate,
}: Readonly<{
  visible: boolean;
  name: string;
  onCreate: () => void;
}>) {
  const p = usePalette();
  if (!visible) return null;
  return (
    <View style={[ui.card, styles.empty, { backgroundColor: p['surface-200'] }]}>
      <View style={[styles.emptyIcon, { backgroundColor: p['brand-soft'] }]}>
        <Feather name={name ? 'search' : 'layers'} size={28} color={p['brand-ink']} />
      </View>
      <Text style={[ui.heading, { color: p.ink, textAlign: 'center' }]}>
        {name ? 'No routines found' : 'Build your first routine'}
      </Text>
      <Text style={[textStyles.body, { color: p['ink-muted'], textAlign: 'center' }]}>
        {name
          ? 'Try a different name to find your routine.'
          : 'Choose your exercises, plan your sets and make your next workout easier to start.'}
      </Text>
      {!name ? (
        <Button
          title="Create routine"
          accessibilityLabel="Create routine"
          icon="plus"
          tone="positive"
          onPress={onCreate}
        />
      ) : null}
    </View>
  );
}

function RoutineRow({
  accountId,
  item,
  starting,
  failure,
  onEdit,
  onActions,
  canStart,
  onStart,
  actionsOpen,
  onRetry,
}: Readonly<{
  accountId: number;
  item: RoutineSummary;
  starting: boolean;
  failure?: unknown;
  onEdit: () => void;
  onActions: (restoreFocus: () => void) => void;
  canStart: boolean;
  onStart: () => void;
  actionsOpen: boolean;
  onRetry: () => void;
}>) {
  const p = usePalette();
  const trigger = useRef<View>(null);
  const performed = item.last_performed_at ? new Date(item.last_performed_at) : null;
  const date = performed
    ? performed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Not trained yet';
  const count = `${item.exercise_count} ${item.exercise_count === 1 ? 'exercise' : 'exercises'}`;
  const dateLabel = performed ? `Last trained ${performed.toLocaleString()}` : date;
  return (
    <View style={[ui.card, styles.routineCard, { backgroundColor: p['surface-200'] }]}>
      <View style={styles.cardMain}>
        <RoutineCover
          accountId={accountId}
          routineId={item.id}
          path={item.image_url}
          size={sizes['control-height']}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.name}`}
          accessibilityHint="Open routine details and edit"
          accessibilityState={{ disabled: false }}
          onPress={onEdit}
          style={({ pressed }) => [styles.routineDetails, { opacity: pressed ? 0.55 : 1 }]}
        >
          <View style={styles.routineText}>
            <Text numberOfLines={2} style={[textStyles['title-lg'], { color: p.ink }]}>
              {item.name}
            </Text>
            {item.notes ? (
              <Text
                numberOfLines={2}
                ellipsizeMode="tail"
                style={[textStyles['body-sm'], { color: p['ink-muted'] }]}
              >
                {item.notes}
              </Text>
            ) : null}
          </View>
        </Pressable>
        <Pressable
          ref={trigger}
          accessibilityRole="button"
          accessibilityLabel={`Routine actions for ${item.name}`}
          accessibilityState={{ expanded: actionsOpen }}
          accessibilityHint="Open train, edit, cover and delete options"
          onPress={() => onActions(() => trigger.current?.focus())}
          style={({ pressed }) => [styles.actions, { opacity: pressed ? 0.55 : 1 }]}
        >
          <Feather name="more-horizontal" size={22} color={p['ink-muted']} />
        </Pressable>
      </View>
      <View style={styles.cardFooter}>
        <View
          style={{
            backgroundColor: p['surface-300'],
            borderRadius: radii['radius-pill'],
            paddingHorizontal: spacing['space-3'],
            paddingVertical: spacing['space-2'],
          }}
        >
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{count}</Text>
        </View>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          accessibilityLabel={dateLabel}
          style={[textStyles['body-sm'], { flex: 1, minWidth: 0, color: p['ink-muted'] }]}
        >
          {date}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Start ${item.name}`}
          accessibilityHint="Train this routine"
          accessibilityState={{ disabled: !canStart || starting, busy: starting }}
          disabled={!canStart || starting}
          onPress={onStart}
          style={({ pressed }) => ({
            width: sizes['tap-min'],
            height: sizes['tap-min'],
            borderRadius: radii['radius-md'],
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: p['brand-soft'],
            opacity: !canStart || starting || pressed ? 0.55 : 1,
          })}
        >
          {starting ? (
            <ActivityIndicator size="small" color={p['brand-ink']} />
          ) : (
            <MaterialIcons name="play-arrow" size={30} color={p['brand-ink']} />
          )}
        </Pressable>
      </View>
      {failure !== undefined ? <Failure error={failure} retry={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  create: {
    minWidth: sizes['tap-min'],
    minHeight: sizes['tap-min'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['space-1'],
  },
  empty: { alignItems: 'center', paddingVertical: spacing['space-8'], gap: spacing['space-4'] },
  emptyIcon: { padding: spacing['space-4'], borderRadius: radii['radius-lg'] },
  routineCard: {
    marginBottom: spacing['space-3'],
    padding: spacing['space-4'],
    gap: spacing['space-4'],
  },
  routineDetails: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-3'],
    minHeight: sizes['tap-min'],
  },
  routineText: { flex: 1, minWidth: 0, gap: spacing['space-1'] },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-3'] },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-2'] },
  actions: {
    width: sizes['tap-min'],
    height: sizes['tap-min'],
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

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
