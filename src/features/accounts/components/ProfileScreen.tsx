import { getTranslation } from '@/i18n/catalog';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage, type Language } from '@/i18n/Language';
import { ScreenHeader } from '@/components/ScreenHeader';
import { countLabel } from '@/features/feed/format';
import { textStyles, spacing, usePalette } from '@/theme/tokens';
import { getObjective } from '../api';
import { profileDefaults } from '../profileForm';
import type { Account } from '../schemas';
import { objectiveOptions } from './ObjectiveEditor';
import { activityOptions } from './ProfileEditor';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileBack } from './ProfileBack';
import { ProfileGroup, ProfileRow } from './ProfileRows';
import { setupStyles as s } from './SetupUI';

export type ProfilePanel =
  | 'overview'
  | 'profile'
  | 'objective'
  | 'nutrition'
  | 'activity'
  | 'progress'
  | 'history'
  | 'friends';
export function ProfileScreen({
  account,
  onOpen,
  onBack,
  backLabel,
  onSignOut,
  signingOut,
  signOutError,
  friendRequests = 0,
}: Readonly<{
  account: Account;
  onOpen: (panel: ProfilePanel) => void;
  onBack: () => void;
  backLabel: string;
  onSignOut: () => void;
  signingOut: boolean;
  signOutError: string;
  /** Incoming friend requests, shown on the Friends row. */
  friendRequests?: number;
}>) {
  const p = usePalette();
  const language = useLanguage();
  const es = language === 'es';
  const objective = useQuery({
    queryKey: ['accounts', account.id, 'objective'],
    queryFn: ({ signal }) => getObjective(signal),
  });
  const goalOption = objectiveOptions.find((item) => item.value === objective.data?.objective);
  const goal = es ? goalOption?.labelEs : goalOption?.label;
  const activity = activityOptions.find((item) => item.value === account.profile.activity_level);
  const { imperial, details } = profileSummary(account, language);
  const activityLabel = es ? activity?.labelEs : activity?.label;
  const friendDetail = friendRequests
    ? countLabel(
        friendRequests,
        getTranslation(language)('accountsUi.new_request'),
        getTranslation(language)('accountsUi.new_requests'),
      )
    : getTranslation(language)('accountsUi.your_friends_requests_and_people_search');
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[s.screen, { backgroundColor: p['surface-100'] }]}
    >
      <ScrollView contentContainerStyle={[s.content, { gap: spacing['space-4'] }]}>
        <ScreenHeader
          title={getTranslation(language)('accountsUi.profile')}
          leading={<ProfileBack onPress={onBack} label={backLabel} />}
        />
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
        <ProfileGroup title={getTranslation(language)('accountsUi.account')}>
          <ProfileRow
            title={getTranslation(language)('accountsUi.edit_profile')}
            detail={
              imperial
                ? getTranslation(language)('accountsUi.imperial_lb_ft_and_in')
                : getTranslation(language)('accountsUi.metric_kg_and_cm')
            }
            icon="user"
            onPress={() => onOpen('profile')}
          />
        </ProfileGroup>
        <ProfileGroup title={getTranslation(language)('accountsUi.your_plan')}>
          <ProfileRow
            title={getTranslation(language)('accountsUi.weekly_activity')}
            detail={
              activityLabel ?? getTranslation(language)('accountsUi.choose_your_activity_level')
            }
            icon="activity"
            onPress={() => onOpen('activity')}
          />
          <ProfileRow
            title={getTranslation(language)('accountsUi.change_objective')}
            detail={
              objective.isPending
                ? getTranslation(language)('accountsUi.loading')
                : (goal ?? getTranslation(language)('accountsUi.objective_unavailable'))
            }
            icon="target"
            onPress={() => onOpen('objective')}
          />
          {objective.isError ? (
            <ProfileRow
              title={getTranslation(language)('accountsUi.retry_objective')}
              icon="refresh-cw"
              onPress={() => {
                void objective.refetch();
              }}
            />
          ) : null}
          <ProfileRow
            title={getTranslation(language)('accountsUi.edit_nutrition_goal')}
            icon="pie-chart"
            onPress={() => onOpen('nutrition')}
          />
        </ProfileGroup>
        <ProfileGroup title={'Social'}>
          <ProfileRow
            title={getTranslation(language)('accountsUi.friends')}
            detail={friendDetail}
            icon="users"
            onPress={() => onOpen('friends')}
          />
        </ProfileGroup>
        <ProfileGroup title={getTranslation(language)('accountsUi.activity')}>
          <ProfileRow
            title={getTranslation(language)('accountsUi.progress')}
            icon="bar-chart-2"
            onPress={() => onOpen('progress')}
          />
          <ProfileRow
            title={getTranslation(language)('accountsUi.training_history')}
            icon="clock"
            onPress={() => onOpen('history')}
          />
        </ProfileGroup>
        <ProfileRow
          title={
            signingOut
              ? getTranslation(language)('accountsUi.signing_out')
              : getTranslation(language)('accountsUi.sign_out')
          }
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

function profileSummary(account: Account, language: Language) {
  const values = profileDefaults(account);
  const imperial = values.measurement_system === 'imperial';
  const heightLabel = imperial
    ? `${values.height_ft} ft ${values.height_in} in`
    : `${values.height_cm} cm`;
  const height = account.profile.height_cm === null ? null : heightLabel;
  const weightUnit = imperial ? 'lb' : 'kg';
  const weight = account.profile.weight_kg === null ? null : `${values.weight} ${weightUnit}`;
  const details = [
    account.profile.age === null
      ? null
      : `${account.profile.age} ${getTranslation(language)('accountsUi.years')}`,
    height,
    weight,
  ]
    .filter(Boolean)
    .join(' · ');
  return { imperial, details };
}
