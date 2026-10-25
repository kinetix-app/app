import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from '@tanstack/react-query';
import { useNetworkState } from 'expo-network';

/** One private cache per signed-in account, shared by every feature. */
export function PrivateQueryProvider({ children }: React.PropsWithChildren) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30000, gcTime: 0 },
          mutations: { retry: false, gcTime: 0 },
        },
      }),
  );
  const network = useNetworkState();
  useEffect(() => {
    onlineManager.setOnline(network.isConnected !== false && network.isInternetReachable !== false);
  }, [network.isConnected, network.isInternetReachable]);
  useEffect(() => {
    focusManager.setFocused(
      ['background', 'inactive'].includes(AppState.currentState) ? false : undefined,
    );
    const subscription = AppState.addEventListener('change', (state) =>
      focusManager.setFocused(state === 'active'),
    );
    return () => {
      subscription.remove();
      void client.cancelQueries();
      client.clear();
    };
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
