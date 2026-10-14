import { getAuthMode } from '@/config/environment';
import { ClerkSignInScreen } from '@/features/auth/ClerkSignInScreen';

export function AuthenticationScreen() {
  // Keep the development credential form behind Metro's compile-time development guard.
  if (__DEV__ && getAuthMode() === 'basic') {
    const { DevelopmentSignInScreen } =
      require('@/features/auth/DevelopmentSignInScreen') as typeof import('./DevelopmentSignInScreen');
    return <DevelopmentSignInScreen />;
  }
  return <ClerkSignInScreen />;
}
