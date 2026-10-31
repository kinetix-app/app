import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { PrivateQueryProvider } from '@/providers/PrivateQueryProvider';
import { NutritionDiaryScreen, NutritionGoalEditor } from '@/features/nutrition';
import {
  SessionHost,
  SessionProvider,
  TrainingWorkspace,
  WorkoutHistory,
  useSession,
} from '@/features/training';
import { getAccount, type Account } from '@/features/accounts/api';
import {
  ProfileEditor,
  ObjectiveEditor,
  ProfileOverview,
  ProfileScreen,
  ProgressScreen,
  type ProfilePanel,
  SetupButton,
} from '@/features/accounts';
import { FormCheckProvider } from '@/features/formcheck';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { spacing, usePalette } from '@/theme/tokens';
import { BottomBar, type HomeTab } from './BottomBar';

/** Keeps recordings only for sets that still exist in the ongoing workout. */
function FormCheckHost({ accountId, children }: React.PropsWithChildren<{ accountId: number }>) {
  const { draft, ready } = useSession();
  const liveSetIds = useMemo(
    () =>
      ready ? new Set(draft?.exercises.flatMap((slot) => slot.sets.map((set) => set.id))) : null,
    [draft, ready],
  );
  return (
    <FormCheckProvider accountId={accountId} liveSetIds={liveSetIds}>
      {children}
    </FormCheckProvider>
  );
}

type HomeNavigationProps = Readonly<{
  account: Account;
  initialTab: HomeTab;
  onAccount: (account: Account) => void;
}>;

function HomeNavigation({ account, initialTab, onAccount }: HomeNavigationProps) {
  const accountId = account.id;
  const [profilePanel, setProfilePanel] = useState<ProfilePanel>('overview');
  const [nutritionOrigin, setNutritionOrigin] = useState<'profile' | 'nutrition'>('profile');
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const loggingOut = useRef(false);
  const p = usePalette();
  const session = useSession();
  const [tab, setTab] = useState<HomeTab>(initialTab);
  const [visited, setVisited] = useState<HomeTab[]>([initialTab]);
  function select(next: HomeTab) {
    setVisited((current) => (current.includes(next) ? current : [...current, next]));
    setTab(next);
  }
  function openProfile(panel: ProfilePanel) {
    setProfilePanel(panel);
    if (panel === 'nutrition') setNutritionOrigin('profile');
    select('profile');
  }
  async function signOut() {
    if (loggingOut.current) return;
    loggingOut.current = true;
    setSigningOut(true);
    setSignOutError('');
    try {
      const success = await session.signOut();
      if (!success) setSignOutError('Could not sign out. Please try again.');
    } catch {
      setSignOutError('Could not sign out. Please try again.');
    } finally {
      loggingOut.current = false;
      setSigningOut(false);
    }
  }
  const panelActive = tab === 'profile' && (!session.draft || session.draft.minimized);
  function closeProfilePanel() {
    setProfilePanel('overview');
  }
  useHardwareBack(
    () => {
      closeProfilePanel();
      return true;
    },
    panelActive && profilePanel === 'progress',
  );
  function renderProfilePanel() {
    switch (profilePanel) {
      case 'profile':
        return (
          <ProfileEditor
            mode="edit"
            account={account}
            active={panelActive}
            onSaved={(next) => {
              onAccount(next);
              setProfilePanel('overview');
            }}
            onCancel={() => setProfilePanel('overview')}
          />
        );
      case 'objective':
        return (
          <ObjectiveEditor
            accountId={accountId}
            active={panelActive}
            onSaved={(next) => {
              onAccount(next);
              setProfilePanel('overview');
            }}
            onCancel={() => setProfilePanel('overview')}
          />
        );
      case 'nutrition':
        return (
          <NutritionGoalEditor
            accountId={accountId}
            active={panelActive}
            onClose={() => {
              setProfilePanel('overview');
              if (nutritionOrigin === 'nutrition') select('nutrition');
            }}
          />
        );
      case 'history':
        return (
          <WorkoutHistory
            accountId={accountId}
            onClose={closeProfilePanel}
            backLabel="Back to profile"
            active={panelActive}
          />
        );
      case 'progress':
        return <ProgressScreen account={account} onClose={closeProfilePanel} />;
      default:
        return (
          <ProfileScreen
            account={account}
            onOpen={openProfile}
            onSignOut={() => {
              void signOut();
            }}
            signingOut={signingOut}
            signOutError={signOutError}
          />
        );
    }
  }
  function renderTabContent(item: HomeTab) {
    if (item === 'home')
      return (
        <ProfileOverview
          account={account}
          onOpenProfile={() => openProfile('overview')}
          onEditObjective={() => openProfile('objective')}
          onEditNutrition={() => {
            openProfile('nutrition');
            setNutritionOrigin('nutrition');
          }}
          onWorkout={() => select('workout')}
        />
      );
    if (item === 'profile') return renderProfilePanel();
    if (item === 'workout')
      return (
        <TrainingWorkspace
          accountId={accountId}
          showStartAction={false}
          onHistory={() => openProfile('history')}
        />
      );
    return (
      <NutritionDiaryScreen
        accountId={accountId}
        onEditGoal={() => {
          openProfile('nutrition');
          setNutritionOrigin('nutrition');
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
      <FormCheckHost accountId={accountId}>
        <HomeNavigation account={account} initialTab={initialTab} onAccount={saved} />
      </FormCheckHost>
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
