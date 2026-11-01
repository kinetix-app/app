import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { ProfileAvatar } from './ProfileAvatar';
import { getObjective } from '../api';
import type { Account } from '../schemas';
import { objectiveOptions } from './ObjectiveEditor';
import { ProfileRow } from './ProfileRows';
import { SetupButton, setupStyles as s } from './SetupUI';

type ProfileOverviewProps = Readonly<{
  account: Account;
  onOpenProfile: () => void;
  onEditObjective: () => void;
  onEditNutrition: () => void;
  onWorkout: () => void;
}>;

export function ProfileOverview({
  account,
  onOpenProfile,
  onEditObjective,
  onEditNutrition,
  onWorkout,
}: ProfileOverviewProps) {
  const p = usePalette();
  const objective = useQuery({
    queryKey: ['accounts', account.id, 'objective'],
    queryFn: ({ signal }) => getObjective(signal),
  });
  const name = objectiveOptions.find((option) => option.value === objective.data?.objective)?.label;
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[s.screen, { backgroundColor: p['surface-100'] }]}
    >
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader title="Home" />
        <View style={[s.card, { backgroundColor: p['surface-200'] }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['space-4'] }}>
            <ProfileAvatar account={account} size={64} />
            <View style={{ flex: 1, gap: spacing['space-1'] }}>
              <Text style={[textStyles['title-md'], { color: p.ink }]}>
                {account.profile.display_name}
              </Text>
              <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                {account.profile.measurement_system === 'imperial'
                  ? 'Imperial · lb, ft and in'
                  : 'Metric · kg and cm'}
              </Text>
            </View>
          </View>
          <ProfileRow title="View profile" icon="user" onPress={onOpenProfile} />
        </View>
        <View style={[s.card, { backgroundColor: p['surface-200'] }]}>
          <Text style={[textStyles['title-md'], { color: p.ink }]}>Your plan</Text>
          <Text style={[textStyles.body, { color: p.ink }]}>
            {objective.isPending ? 'Loading objective…' : (name ?? 'Objective unavailable')}
          </Text>
          {objective.isError ? (
            <>
              <Text accessibilityRole="alert" style={{ color: p.danger }}>
                Could not load your objective.
              </Text>
              <SetupButton
                title="Retry"
                secondary
                onPress={() => {
                  void objective.refetch();
                }}
              />
            </>
          ) : null}
          <ProfileRow title="Change objective" icon="target" onPress={onEditObjective} />
          <ProfileRow title="Edit nutrition goal" icon="pie-chart" onPress={onEditNutrition} />
          <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
            Nutrition targets are optional.
          </Text>
        </View>
        <ProfileRow title="Workout" icon="activity" onPress={onWorkout} />
      </ScrollView>
    </SafeAreaView>
  );
}
