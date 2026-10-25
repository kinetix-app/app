import React, { useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { PrivateQueryProvider } from '@/providers/PrivateQueryProvider';
import { NutritionDiaryScreen, NutritionGoalEditor } from '@/features/nutrition';
import { SessionHost, SessionProvider, TrainingWorkspace, useSession } from '@/features/training';
import { usePalette } from '@/theme/tokens';
import { BottomBar, type HomeTab } from './BottomBar';

function HomeNavigation({ accountId, initialTab }: { accountId: number; initialTab: HomeTab }) {
  const p = usePalette();
  const session = useSession();
  const [tab, setTab] = useState<HomeTab>(initialTab);
  const [visited, setVisited] = useState<HomeTab[]>([initialTab]);
  function select(next: HomeTab) {
    setVisited((current) => (current.includes(next) ? current : [...current, next]));
    setTab(next);
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
            {item === 'home' ? (
              <NutritionGoalEditor accountId={accountId} onClose={() => select('nutrition')} />
            ) : item === 'workout' ? (
              <TrainingWorkspace accountId={accountId} showStartAction={false} />
            ) : (
              <NutritionDiaryScreen accountId={accountId} onEditGoal={() => select('home')} />
            )}
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

function PrivateHome({
  accountId,
  onSignOut,
  initialTab,
}: {
  accountId: number;
  onSignOut: () => void;
  initialTab: HomeTab;
}) {
  return (
    <PrivateQueryProvider>
      <StatusBar style="auto" />
      <SessionProvider accountId={accountId} onSignOut={onSignOut}>
        <HomeNavigation accountId={accountId} initialTab={initialTab} />
      </SessionProvider>
    </PrivateQueryProvider>
  );
}

/** Account changes discard every private query, form and navigation state. */
export function HomeScreen({
  accountId,
  onSignOut,
  initialTab = 'home',
}: {
  accountId: number;
  onSignOut: () => void;
  initialTab?: HomeTab;
}) {
  return (
    <PrivateHome
      key={accountId}
      accountId={accountId}
      onSignOut={onSignOut}
      initialTab={initialTab}
    />
  );
}
