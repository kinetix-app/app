import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
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
  ProfileAvatar,
  ProfileEditor,
  ObjectiveEditor,
  ProfileScreen,
  ProgressScreen,
  type ProfilePanel,
  SetupButton,
} from '@/features/accounts';
import { FeedScreen } from '@/features/feed';
import { FriendsScreen, friendsApi, requestsKey } from '@/features/friends';
import { LeaguesScreen } from '@/features/leagues';
import { FormCheckProvider } from '@/features/formcheck';
import { Button, ui } from '@/features/training/components/ui';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { sizes, spacing, usePalette } from '@/theme/tokens';
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

type ProfileOrigin = Exclude<HomeTab, 'profile'>;
const profileBackLabels: Record<ProfileOrigin, string> = {
  home: 'Back to feed',
  workout: 'Back to workout',
  nutrition: 'Back to nutrition',
  league: 'Back to leagues',
};

type HomeNavigationProps = Readonly<{
  account: Account;
  initialTab: HomeTab;
  onAccount: (account: Account) => void;
  finishedSessionId: number | null;
  onDismissFinished: () => void;
  initialInvitation?: string;
}>;

function HomeNavigation({
  account,
  initialTab,
  onAccount,
  finishedSessionId,
  onDismissFinished,
  initialInvitation,
}: HomeNavigationProps) {
  const accountId = account.id;
  const cache = useQueryClient();
  const [profilePanel, setProfilePanel] = useState<ProfilePanel>('overview');
  const [nutritionOrigin, setNutritionOrigin] = useState<'profile' | 'nutrition'>('profile');
  const [addingFood, setAddingFood] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const loggingOut = useRef(false);
  const p = usePalette();
  const session = useSession();
  const [tab, setTab] = useState<HomeTab>(initialTab);
  const [routineEditing, setRoutineEditing] = useState(false);
  // Pending requests drive the Profile badge; refreshed periodically while signed in.
  const requests = useQuery({
    queryKey: requestsKey(accountId),
    queryFn: ({ signal }) => friendsApi.requests(signal),
    refetchInterval: 60000,
  });
  const incomingRequests = requests.data?.incoming.length ?? 0;
  const [leagueDetailOpen, setLeagueDetailOpen] = useState(false);
  const [visited, setVisited] = useState<HomeTab[]>([initialTab]);
  const [profileOrigin, setProfileOrigin] = useState<ProfileOrigin>(
    initialTab === 'profile' ? 'home' : initialTab,
  );
  function select(next: HomeTab) {
    if (next === 'league') void cache.invalidateQueries({ queryKey: ['leagues', accountId] });
    setAddingFood(false);
    setVisited((current) => (current.includes(next) ? current : [...current, next]));
    setTab(next);
  }
  const [composeSessionId, setComposeSessionId] = useState<number | null>(null);
  /** Opens the Feed's new-post screen with a completed workout selected. */
  function shareWorkout(sessionId: number) {
    setComposeSessionId(sessionId);
    select('home');
  }
  /** Resumes Profile on its current panel, so unsaved edits survive leaving it. */
  function showProfile() {
    if (tab !== 'profile') setProfileOrigin(tab);
    select('profile');
  }
  function openProfile(panel: ProfilePanel) {
    setProfilePanel(panel);
    if (panel === 'nutrition') setNutritionOrigin('profile');
    showProfile();
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
      if (profilePanel === 'progress') closeProfilePanel();
      else select(profileOrigin);
      return true;
    },
    panelActive && (profilePanel === 'progress' || profilePanel === 'overview'),
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
            onShare={shareWorkout}
          />
        );
      case 'progress':
        return <ProgressScreen account={account} onClose={closeProfilePanel} />;
      case 'friends':
        return (
          <FriendsScreen
            accountId={accountId}
            onClose={closeProfilePanel}
            active={panelActive}
            initialTab={incomingRequests ? 'requests' : 'friends'}
          />
        );
      default:
        return (
          <ProfileScreen
            account={account}
            onOpen={openProfile}
            onBack={() => select(profileOrigin)}
            backLabel={profileBackLabels[profileOrigin]}
            onSignOut={() => {
              void signOut();
            }}
            signingOut={signingOut}
            signOutError={signOutError}
            friendRequests={incomingRequests}
          />
        );
    }
  }
  function renderTabContent(item: HomeTab) {
    if (item === 'home')
      return (
        <FeedScreen
          accountId={accountId}
          active={tab === 'home' && (!session.draft || session.draft.minimized)}
          composeSessionId={composeSessionId}
          onComposeClosed={() => setComposeSessionId(null)}
          onFindFriends={() => openProfile('friends')}
          profileButton={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              accessibilityHint={
                incomingRequests
                  ? `${incomingRequests} new friend ${incomingRequests === 1 ? 'request' : 'requests'}`
                  : undefined
              }
              onPress={showProfile}
              hitSlop={spacing['space-1']}
              style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
            >
              <ProfileAvatar account={account} size={sizes['tap-min']} compact />
              {incomingRequests ? (
                <View
                  testID="friend-request-badge"
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    borderWidth: 2,
                    borderColor: p['surface-100'],
                    backgroundColor: p.danger,
                  }}
                />
              ) : null}
            </Pressable>
          }
        />
      );
    if (item === 'profile') return renderProfilePanel();
    if (item === 'league')
      return (
        <LeaguesScreen
          accountId={accountId}
          initialInvitation={initialInvitation}
          active={tab === 'league'}
          onDetailOpenChange={setLeagueDetailOpen}
        />
      );
    if (item === 'workout')
      return <TrainingWorkspace accountId={accountId} onEditingChange={setRoutineEditing} />;
    return (
      <NutritionDiaryScreen
        accountId={accountId}
        onAddFoodOpenChange={setAddingFood}
        onEditGoal={() => {
          openProfile('nutrition');
          setNutritionOrigin('nutrition');
        }}
      />
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: p['surface-100'] }}>
      <SessionHost hideMinimized={tab === 'workout' && routineEditing}>
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
      {!addingFood &&
      (tab !== 'workout' || !routineEditing) &&
      (tab !== 'league' || !leagueDetailOpen) ? (
        <BottomBar
          tab={tab}
          onSelect={select}
          canStart={session.ready && !session.pending && !session.storageError && !session.draft}
          onStart={() => session.start()}
        />
      ) : null}
      <Modal
        visible={finishedSessionId !== null && !session.draft}
        transparent
        animationType="fade"
        onRequestClose={onDismissFinished}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing['space-6'],
            backgroundColor: p.scrim,
          }}
        >
          <View
            accessibilityViewIsModal
            style={[ui.card, { backgroundColor: p['surface-200'], width: '100%', maxWidth: 420 }]}
          >
            <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
              Workout saved
            </Text>
            <Text style={{ color: p['ink-muted'] }}>
              Share it to your feed so your friends can cheer you on.
            </Text>
            <Button
              title="Share to feed"
              icon="share"
              onPress={() => {
                if (finishedSessionId !== null) shareWorkout(finishedSessionId);
                onDismissFinished();
              }}
            />
            <Button title="Not now" secondary onPress={onDismissFinished} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

type AccountGateProps = Readonly<{
  accountId: number;
  onSignOut: () => void;
  initialTab: HomeTab;
  initialAccount?: Account;
  initialInvitation?: string;
}>;

function AccountGate({
  accountId,
  onSignOut,
  initialTab,
  initialAccount,
  initialInvitation,
}: AccountGateProps) {
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
  const [finishedSessionId, setFinishedSessionId] = useState<number | null>(null);
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
    <SessionProvider accountId={accountId} onSignOut={onSignOut} onFinished={setFinishedSessionId}>
      <FormCheckHost accountId={accountId}>
        <HomeNavigation
          account={account}
          initialTab={initialTab}
          initialInvitation={initialInvitation}
          onAccount={saved}
          finishedSessionId={finishedSessionId}
          onDismissFinished={() => setFinishedSessionId(null)}
        />
      </FormCheckHost>
    </SessionProvider>
  );
}
type PrivateHomeProps = Readonly<{
  accountId: number;
  onSignOut: () => void;
  initialTab: HomeTab;
  initialAccount?: Account;
  initialInvitation?: string;
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
  initialInvitation?: string;
}>;

export function HomeScreen({
  accountId,
  onSignOut,
  initialTab = 'home',
  initialAccount,
  initialInvitation,
}: HomeScreenProps) {
  return (
    <PrivateHome
      key={accountId}
      accountId={accountId}
      onSignOut={onSignOut}
      initialTab={initialTab}
      initialAccount={initialAccount}
      initialInvitation={initialInvitation}
    />
  );
}
