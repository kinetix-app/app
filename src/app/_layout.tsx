import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getApiBaseUrl, getClerkPublishableKey } from '@/config/environment';

export default function RootLayout() {
  // Reject invalid public configuration before any feature makes a request.
  getApiBaseUrl();
  getClerkPublishableKey();

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
