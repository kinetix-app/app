import React, { lazy, Suspense } from 'react';
import { ActivityIndicator } from 'react-native';

import { getAuthMode } from '@/config/environment';

const ClerkAuthentication = lazy(() => import('./ClerkAuthentication'));

// Keep the development credential form behind Metro's compile-time development guard.
const DevelopmentSignInScreen = __DEV__
  ? lazy(async () => {
      const screen = await import('@/features/auth/components/DevelopmentSignInScreen');
      return { default: screen.DevelopmentSignInScreen };
    })
  : null;

export function AuthenticationScreen({
  initialTab = 'home',
}: {
  initialTab?: 'home' | 'nutrition';
}) {
  if (__DEV__ && getAuthMode() === 'basic' && DevelopmentSignInScreen) {
    return (
      <Suspense fallback={<ActivityIndicator accessibilityLabel="Loading sign-in" />}>
        <DevelopmentSignInScreen initialTab={initialTab} />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<ActivityIndicator accessibilityLabel="Loading authentication" />}>
      <ClerkAuthentication initialTab={initialTab} />
    </Suspense>
  );
}
