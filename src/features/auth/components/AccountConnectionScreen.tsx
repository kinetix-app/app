import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

import { AuthStatusScreen } from './AuthStatusScreen';

type AccountConnectionScreenProps = Readonly<{
  error: string;
  leaving: boolean;
  onRetry: () => void;
  onSignOut: () => void;
}>;

export function AccountConnectionScreen({
  error,
  leaving,
  onRetry,
  onSignOut,
}: AccountConnectionScreenProps) {
  const palette = usePalette();

  return (
    <AuthStatusScreen
      title={leaving ? 'Signing out…' : error ? 'Couldn’t connect' : 'Connecting your account…'}
      description={leaving ? undefined : error || undefined}
      failed={Boolean(error) && !leaving}
      loadingLabel={leaving ? 'Signing out' : error ? undefined : 'Connecting your account'}
    >
      <View style={styles.actions}>
        {error && !leaving ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={({ pressed }) => [
              styles.action,
              styles.primary,
              { backgroundColor: palette.brand, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Ionicons accessible={false} name="refresh" size={20} color={palette['on-brand']} />
            <Text style={[textStyles.label, { color: palette['on-brand'] }]}>Retry connection</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: leaving }}
          disabled={leaving}
          onPress={onSignOut}
          style={({ pressed }) => [styles.action, { opacity: leaving || pressed ? 0.5 : 1 }]}
        >
          <Ionicons
            accessible={false}
            name="log-out-outline"
            size={20}
            color={palette['ink-muted']}
          />
          <Text style={[textStyles.label, { color: palette['ink-muted'] }]}>Sign out</Text>
        </Pressable>
      </View>
    </AuthStatusScreen>
  );
}

const styles = StyleSheet.create({
  actions: { width: '100%', gap: spacing['space-2'] },
  action: {
    minHeight: sizes['tap-min'],
    paddingHorizontal: spacing['space-4'],
    paddingVertical: spacing['space-3'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['space-2'],
    borderRadius: radii['radius-md'],
  },
  primary: { minHeight: sizes['control-height'] },
});
