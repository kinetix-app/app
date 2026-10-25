import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import React from 'react';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getClerkPublishableKey } from '@/config/environment';

import { authStyles } from './authStyles';
import { ClerkSignInScreen } from './ClerkSignInScreen';

export default function ClerkAuthentication({
  initialTab = 'home',
}: {
  initialTab?: 'home' | 'nutrition';
}) {
  const publishableKey = getClerkPublishableKey();
  if (!publishableKey) {
    return (
      <SafeAreaView style={authStyles.screen}>
        <Text accessibilityRole="alert" style={authStyles.error}>
          Sign-in is unavailable. Clerk configuration is missing.
        </Text>
      </SafeAreaView>
    );
  }
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkSignInScreen initialTab={initialTab} />
    </ClerkProvider>
  );
}
