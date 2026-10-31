import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { textStyles, spacing, usePalette } from '@/theme/tokens';
import { getObjective } from '../api';
import { profileDefaults } from '../profileForm';
import type { Account } from '../schemas';
import { objectiveOptions } from './ObjectiveEditor';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileGroup, ProfileRow } from './ProfileRows';
import { setupStyles as s } from './SetupUI';

export type ProfilePanel =
  'overview' | 'profile' | 'objective' | 'nutrition' | 'progress' | 'history';
export function ProfileScreen({
  account,
  onOpen,
  onSignOut,
  signingOut,
  signOutError,
}: Readonly<{
  account: Account;
  onOpen: (panel: ProfilePanel) => void;
  onSignOut: () => void;
  signingOut: boolean;
  signOutError: string;
}>) {
  const p = usePalette();
  const objective = useQuery({
    queryKey: ['accounts', account.id, 'objective'],
    queryFn: ({ signal }) => getObjective(signal),
  });
  const goal = objectiveOptions.find((item) => item.value === objective.data?.objective)?.label;
  const values = profileDefaults(account);
  const imperial = values.measurement_system === 'imperial';
  const height =
    account.profile.height_cm === null
      ? null
      : imperial
        ? `${values.height_ft} ft ${values.height_in} in`
        : `${values.height_cm} cm`;
  const weight =
    account.profile.weight_kg === null ? null : `${values.weight} ${imperial ? 'lb' : 'kg'}`;
  const details = [
    account.profile.age === null ? null : `${account.profile.age} years`,
    height,
    weight,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[s.screen, { backgroundColor: p['surface-100'] }]}
    >
      <ScrollView contentContainerStyle={[s.content, { gap: spacing['space-4'] }]}>
        <ScreenHeader title="Profile" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['space-4'] }}>
          <ProfileAvatar account={account} size={64} />
          <View style={{ flex: 1, gap: spacing['space-1'] }}>
            <Text style={[textStyles['title-md'], { color: p.ink }]}>
              {account.profile.display_name}
            </Text>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{details}</Text>
            {account.profile.timezone ? (
              <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                {account.profile.timezone}
              </Text>
            ) : null}
          </View>
        </View>
        <ProfileGroup title="Account">
          <ProfileRow
            title="Edit profile"
            detail={imperial ? 'Imperial · lb, ft and in' : 'Metric · kg and cm'}
            icon="user"
            onPress={() => onOpen('profile')}
          />
        </ProfileGroup>
        <ProfileGroup title="Your plan">
          <ProfileRow
            title="Change objective"
            detail={objective.isPending ? 'Loading…' : (goal ?? 'Objective unavailable')}
            icon="target"
            onPress={() => onOpen('objective')}
          />
          {objective.isError ? (
            <ProfileRow
              title="Retry objective"
              icon="refresh-cw"
              onPress={() => {
                void objective.refetch();
              }}
            />
          ) : null}
          <ProfileRow
            title="Edit nutrition goal"
            icon="pie-chart"
            onPress={() => onOpen('nutrition')}
          />
        </ProfileGroup>
        <ProfileGroup title="Activity">
          <ProfileRow title="Progress" icon="bar-chart-2" onPress={() => onOpen('progress')} />
          <ProfileRow title="Training history" icon="clock" onPress={() => onOpen('history')} />
        </ProfileGroup>
        <ProfileRow
          title={signingOut ? 'Signing out…' : 'Sign out'}
          icon="log-out"
          onPress={onSignOut}
          disabled={signingOut}
          danger
        />
        {signOutError ? (
          <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
            {signOutError}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
