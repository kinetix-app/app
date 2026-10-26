import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { textStyles, usePalette } from '@/theme/tokens';
import { ProfileAvatar } from './ProfileAvatar';
import { getObjective } from '../api';
import type { Account } from '../schemas';
import { objectiveOptions } from './ObjectiveEditor';
import { SetupButton, setupStyles as s } from './SetupUI';

export function ProfileOverview({
  account,
  onEditProfile,
  onEditObjective,
  onEditNutrition,
  onSignOut,
}: {
  account: Account;
  onEditProfile: () => void;
  onEditObjective: () => void;
  onEditNutrition: () => void;
  onSignOut: () => void;
}) {
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
          <ProfileAvatar account={account} />
          <Text style={[textStyles['title-lg'], { color: p.ink }]}>
            {account.profile.display_name}
          </Text>
          <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
            {account.profile.measurement_system === 'imperial'
              ? 'Imperial · lb, ft and in'
              : 'Metric · kg and cm'}
          </Text>
          <SetupButton title="Edit profile" secondary onPress={onEditProfile} />
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
          <SetupButton title="Change objective" secondary onPress={onEditObjective} />
          <SetupButton title="Edit nutrition goal" onPress={onEditNutrition} />
          <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
            Calories and macros are optional. You can record food without a nutrition goal.
          </Text>
        </View>
        <SetupButton title="Sign out" secondary onPress={onSignOut} />
      </ScrollView>
    </SafeAreaView>
  );
}
