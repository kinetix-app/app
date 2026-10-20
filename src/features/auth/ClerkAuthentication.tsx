import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import React from 'react';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getClerkPublishableKey } from '@/config/environment';

import { ClerkSignInScreen } from './ClerkSignInScreen';

export default function ClerkAuthentication() {
  const publishableKey = getClerkPublishableKey();
  if (!publishableKey) {
    return (
      <SafeAreaView>
        <Text accessibilityRole="alert">
          Sign-in is unavailable. Clerk configuration is missing.
        </Text>
      </SafeAreaView>
    );
  }
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkSignInScreen />
    </ClerkProvider>
  );
}
