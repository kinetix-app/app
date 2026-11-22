import React, { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { usePalette } from '@/theme/tokens';
import { trainingApi } from '../api';
import { Button, Failure, IconButton, Loading, ui } from './ui';
import { WorkoutSessionDetail } from './WorkoutSessionDetail';

export function WorkoutHistory({
  accountId,
  onClose,
  backLabel = 'Back to routines',
  active = true,
  onShare,
}: Readonly<{
  accountId: number;
  onClose: () => void;
  backLabel?: string;
  active?: boolean;
  /** Opens the feed composer with this completed workout selected. */
  onShare?: (sessionId: number) => void;
}>) {
  const p = usePalette();
  const unit = 'kg';
  const [selected, setSelected] = useState<number | null>(null);
  const list = useInfiniteQuery({
    queryKey: ['training', accountId, 'sessions', unit],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => trainingApi.sessions(pageParam, unit, signal),
    getNextPageParam: (page) =>
      page.items.length === page.limit ? page.offset + page.limit : undefined,
  });
  let footer = null;
  if (list.isFetchingNextPage) footer = <Loading />;
  else if (list.isFetchNextPageError)
    footer = (
      <Failure error={list.error} retry={() => void list.fetchNextPage({ cancelRefetch: false })} />
    );
  const back = () => (selected === null ? onClose() : setSelected(null));
  useHardwareBack(() => {
    back();
    return true;
  }, active);
  if (selected !== null)
    return (
      <WorkoutSessionDetail
        accountId={accountId}
        sessionId={selected}
        backLabel="Back to history"
        onBack={back}
        onShare={onShare}
      />
    );
  const header = (
    <View style={ui.gap}>
      <View style={ui.row}>
        <IconButton icon="arrow-left" label={backLabel} onPress={back} />
        <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
          Workout history
        </Text>
      </View>
    </View>
  );
  return (
    <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
      <FlatList
        contentContainerStyle={ui.content}
        data={list.data?.pages.flatMap((page) => page.items) ?? []}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View style={ui.gap}>
            {header}
            {list.isPending ? <Loading /> : null}
            {list.isError ? (
              <Failure
                error={list.error}
                retry={() => {
                  void list.refetch();
                }}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !list.isPending && !list.isError ? (
            <Text style={{ color: p['ink-muted'] }}>No completed workouts yet.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[ui.card, { backgroundColor: p['surface-200'] }]}>
            <Text style={{ color: p.ink }}>
              {new Date(item.ended_at).toLocaleString()} · {item.exercises.length} exercises
            </Text>
            <Button
              title="View workout"
              accessibilityLabel={`View workout ${item.id}`}
              secondary
              onPress={() => setSelected(item.id)}
            />
            {onShare ? (
              <Button
                title="Share to feed"
                accessibilityLabel={`Share workout ${item.id} to feed`}
                tone="positive"
                icon="share"
                onPress={() => onShare(item.id)}
              />
            ) : null}
          </View>
        )}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetching && !list.isFetchNextPageError)
            void list.fetchNextPage({ cancelRefetch: false });
        }}
        ListFooterComponent={footer}
      />
    </SafeAreaView>
  );
}
