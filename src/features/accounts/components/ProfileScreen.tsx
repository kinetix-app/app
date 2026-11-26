import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { selectCopy, useLanguage } from '@/i18n/Language';
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
  const es = useLanguage() === 'es';
  const objective = useQuery({
    queryKey: ['accounts', account.id, 'objective'],
    queryFn: ({ signal }) => getObjective(signal),
  });
  const goalOption = objectiveOptions.find((item) => item.value === objective.data?.objective);
  const goal = es ? goalOption?.labelEs : goalOption?.label;
  const activity = activityOptions.find((item) => item.value === account.profile.activity_level);
  const { imperial, details } = profileSummary(account, es);
  const activityLabel = es ? activity?.labelEs : activity?.label;
  const friendDetail = friendRequests
    ? countLabel(
        friendRequests,
        selectCopy(es, 'nueva solicitud', 'new request'),
        selectCopy(es, 'nuevas solicitudes', 'new requests'),
      )
    : selectCopy(
        es,
        'Amigos, solicitudes y búsqueda de personas',
        'Your friends, requests and people search',
      );
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[s.screen, { backgroundColor: p['surface-100'] }]}
    >
      <ScrollView contentContainerStyle={[s.content, { gap: spacing['space-4'] }]}>
        <ScreenHeader
          title={selectCopy(es, 'Perfil', 'Profile')}
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
        <ProfileGroup title={selectCopy(es, 'Cuenta', 'Account')}>
          <ProfileRow
            title={selectCopy(es, 'Editar perfil', 'Edit profile')}
            detail={
              imperial
                ? selectCopy(es, 'Imperial · lb, pies y pulgadas', 'Imperial · lb, ft and in')
                : selectCopy(es, 'Métrico · kg y cm', 'Metric · kg and cm')
            }
            icon="user"
            onPress={() => onOpen('profile')}
          />
        </ProfileGroup>
        <ProfileGroup title={selectCopy(es, 'Tu plan', 'Your plan')}>
          <ProfileRow
            title={selectCopy(es, 'Actividad semanal', 'Weekly activity')}
            detail={
              activityLabel ??
              selectCopy(es, 'Elige tu nivel de actividad', 'Choose your activity level')
            }
            icon="activity"
            onPress={() => onOpen('activity')}
          />
          <ProfileRow
            title={selectCopy(es, 'Cambiar objetivo', 'Change objective')}
            detail={
              objective.isPending
                ? selectCopy(es, 'Cargando…', 'Loading…')
                : (goal ?? selectCopy(es, 'Objetivo no disponible', 'Objective unavailable'))
            }
            icon="target"
            onPress={() => onOpen('objective')}
          />
          {objective.isError ? (
            <ProfileRow
              title={selectCopy(es, 'Reintentar objetivo', 'Retry objective')}
              icon="refresh-cw"
              onPress={() => {
                void objective.refetch();
              }}
            />
          ) : null}
          <ProfileRow
            title={selectCopy(es, 'Editar objetivo nutricional', 'Edit nutrition goal')}
            icon="pie-chart"
            onPress={() => onOpen('nutrition')}
          />
        </ProfileGroup>
        <ProfileGroup title={'Social'}>
          <ProfileRow
            title={selectCopy(es, 'Amigos', 'Friends')}
            detail={friendDetail}
            icon="users"
            onPress={() => onOpen('friends')}
          />
        </ProfileGroup>
        <ProfileGroup title={selectCopy(es, 'Actividad', 'Activity')}>
          <ProfileRow
            title={selectCopy(es, 'Progreso', 'Progress')}
            icon="bar-chart-2"
            onPress={() => onOpen('progress')}
          />
          <ProfileRow
            title={selectCopy(es, 'Historial de entrenamientos', 'Training history')}
            icon="clock"
            onPress={() => onOpen('history')}
          />
        </ProfileGroup>
        <ProfileRow
          title={
            signingOut
              ? selectCopy(es, 'Cerrando sesión…', 'Signing out…')
              : selectCopy(es, 'Cerrar sesión', 'Sign out')
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

function profileSummary(account: Account, es: boolean) {
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
      : `${account.profile.age} ${selectCopy(es, 'años', 'years')}`,
    height,
    weight,
  ]
    .filter(Boolean)
    .join(' · ');
  return { imperial, details };
}
