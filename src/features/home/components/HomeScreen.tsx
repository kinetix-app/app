import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { PrivateQueryProvider } from '@/providers/PrivateQueryProvider';
import { NutritionDiaryScreen, NutritionGoalEditor } from '@/features/nutrition';
import { SessionHost, SessionProvider, TrainingWorkspace, useSession } from '@/features/training';
import { getAccount, type Account } from '@/features/accounts/api';
import { ProfileEditor, ObjectiveEditor, ProfileOverview, SetupButton } from '@/features/accounts';
import { spacing, usePalette } from '@/theme/tokens';
import { BottomBar, type HomeTab } from './BottomBar';

type HomeNavigationProps = Readonly<{
  account: Account;
  initialTab: HomeTab;
  onSignOut: () => void;
  onAccount: (account: Account) => void;
}>;

function HomeNavigation({ account, initialTab, onSignOut, onAccount }: HomeNavigationProps) {
  const accountId = account.id;
  const [homePanel, setHomePanel] = useState<'overview' | 'profile' | 'objective' | 'nutrition'>(
    'overview',
  );
  const p = usePalette();
  const session = useSession();
  const [tab, setTab] = useState<HomeTab>(initialTab);
  const [visited, setVisited] = useState<HomeTab[]>([initialTab]);
  function select(next: HomeTab) {
    setVisited((current) => (current.includes(next) ? current : [...current, next]));
    setTab(next);
  }
  function renderHomePanel() {
    switch (homePanel) {
      case 'profile':
        return (
          <ProfileEditor
            account={account}
            onSaved={(next) => {
              onAccount(next);
              setHomePanel('overview');
            }}
            onCancel={() => setHomePanel('overview')}
          />
        );
      case 'objective':
        return (
          <ObjectiveEditor
            accountId={accountId}
            onSaved={(next) => {
              onAccount(next);
              setHomePanel('overview');
            }}
            onCancel={() => setHomePanel('overview')}
          />
        );
      case 'nutrition':
        return (
          <NutritionGoalEditor
            accountId={accountId}
            onClose={() => {
              setHomePanel('overview');
              select('nutrition');
            }}
          />
        );
      default:
        return (
          <ProfileOverview
            account={account}
            onEditProfile={() => setHomePanel('profile')}
            onEditObjective={() => setHomePanel('objective')}
            onEditNutrition={() => setHomePanel('nutrition')}
            onSignOut={onSignOut}
          />
        );
    }
  }
  function renderTabContent(item: HomeTab) {
    if (item === 'home') return renderHomePanel();
    if (item === 'workout')
      return <TrainingWorkspace accountId={accountId} showStartAction={false} />;
    return (
      <NutritionDiaryScreen
        accountId={accountId}
        onEditGoal={() => {
          setHomePanel('nutrition');
          select('home');
        }}
      />
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: p['surface-100'] }}>
      <SessionHost>
        {visited.map((item) => (
          <View
            key={item}
            style={{ flex: 1, display: tab === item ? 'flex' : 'none' }}
            aria-hidden={tab !== item}
            accessibilityElementsHidden={tab !== item}
            importantForAccessibility={tab !== item ? 'no-hide-descendants' : 'auto'}
          >
            {renderTabContent(item)}
          </View>
        ))}
      </SessionHost>
      <BottomBar
        tab={tab}
        onSelect={select}
        canStart={session.ready && !session.pending && !session.storageError && !session.draft}
        onStart={() => session.start()}
      />
    </View>
  );
}

type AccountGateProps = Readonly<{
  accountId: number;
  onSignOut: () => void;
  initialTab: HomeTab;
  initialAccount?: Account;
}>;

function AccountGate({ accountId, onSignOut, initialTab, initialAccount }: AccountGateProps) {
  const p = usePalette();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ['accounts', accountId, 'me'],
    queryFn: ({ signal }) => getAccount(undefined, signal),
    initialData: initialAccount,
  });
  useEffect(() => {
    if (!initialAccount) return;
    const queryKey = ['accounts', accountId, 'me'];
    // initialData only seeds a new query. A fresh authenticated response must also
    // replace an existing entry, including after session refresh or Fast Refresh.
    void cache.cancelQueries({ queryKey, exact: true });
    cache.setQueryData(queryKey, initialAccount);
  }, [accountId, cache, initialAccount]);
  function saved(account: Account) {
    cache.setQueryData(['accounts', accountId, 'me'], account);
  }
  if (!query.data)
    return (
      <View
        style={{
          flex: 1,
          padding: spacing['space-6'],
          gap: spacing['space-4'],
          justifyContent: 'center',
          backgroundColor: p['surface-100'],
        }}
      >
        {query.isPending ? (
          <ActivityIndicator accessibilityLabel="Loading account setup" color={p.brand} />
        ) : (
          <>
            <Text accessibilityRole="alert" style={{ color: p.danger }}>
              Could not load your account setup.
            </Text>
            <SetupButton
              title="Retry"
              onPress={() => {
                void query.refetch();
              }}
            />
          </>
        )}
        <SetupButton title="Sign out" secondary onPress={onSignOut} />
      </View>
    );
  const account = query.data;
  if (account.onboarding.required)
    return !account.onboarding.profile_complete ? (
      <ProfileEditor account={account} onSaved={saved} />
    ) : (
      <ObjectiveEditor accountId={accountId} onSaved={saved} />
    );
  return (
    <SessionProvider accountId={accountId} onSignOut={onSignOut}>
      <HomeNavigation
        account={account}
        initialTab={initialTab}
        onSignOut={onSignOut}
        onAccount={saved}
      />
    </SessionProvider>
  );
}
type PrivateHomeProps = Readonly<{
  accountId: number;
  onSignOut: () => void;
  initialTab: HomeTab;
  initialAccount?: Account;
}>;

function PrivateHome(props: PrivateHomeProps) {
  return (
    <PrivateQueryProvider>
      <StatusBar style="auto" />
      <AccountGate {...props} />
    </PrivateQueryProvider>
  );
}

/** Account changes discard every private query, form and navigation state. */
type HomeScreenProps = Readonly<{
  accountId: number;
  onSignOut: () => void;
  initialTab?: HomeTab;
  initialAccount?: Account;
}>;

export function HomeScreen({
  accountId,
  onSignOut,
  initialTab = 'home',
  initialAccount,
}: HomeScreenProps) {
  return (
    <PrivateHome
      key={accountId}
      accountId={accountId}
      onSignOut={onSignOut}
      initialTab={initialTab}
      initialAccount={initialAccount}
    />
  );
}
