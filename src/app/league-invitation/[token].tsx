import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { AuthenticationScreen } from '@/features/auth/components/AuthenticationScreen';

export default function LeagueInvitationRoute() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  return (
    <AuthenticationScreen
      initialTab="league"
      initialInvitation={typeof token === 'string' ? token : undefined}
    />
  );
}
