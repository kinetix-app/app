import { Redirect, Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

export function SsoCallbackScreen() {
  const palette = usePalette();
  const attempted = useRef(false);
  const [status, setStatus] = useState<'completing' | 'success' | 'failed'>('completing');

  useEffect(() => {
    if (Platform.OS !== 'web' || attempted.current) return;
    attempted.current = true;
    void Promise.resolve()
      .then(() => {
        // Keep the callback URL and nonce intact until Expo sends them to the opener.
        // A direct visit must not post an authentication result back to itself.
        if (!window.opener || window.opener.closed) return 'failed' as const;
        const result = WebBrowser.maybeCompleteAuthSession();
        return result?.type === 'success' ? ('success' as const) : ('failed' as const);
      })
      .then(setStatus, () => {
        // SDK diagnostics can contain the callback URL. Never render or log them.
        setStatus('failed');
      });
  }, []);

  if (Platform.OS !== 'web') return <Redirect href="/" />;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette['surface-100'] }]}>
      <View style={styles.content}>
        {status === 'completing' ? (
          <ActivityIndicator accessibilityLabel="Finishing sign-in" color={palette.brand} />
        ) : null}
        <Text style={[textStyles['title-md'], { color: palette.ink }]}>
          {status === 'failed' ? 'Sign-in could not return to your tab' : 'Finishing sign-in'}
        </Text>
        <Text
          accessibilityRole={status === 'failed' ? 'alert' : undefined}
          style={[textStyles.body, { color: palette['ink-muted'] }]}
        >
          {status === 'failed'
            ? 'Close this window and try again in the original tab, or return to sign-in.'
            : 'Return to your original tab. This window will close automatically.'}
        </Text>
        {status === 'failed' ? (
          <Link
            href="/"
            replace
            style={[
              styles.link,
              textStyles.body,
              { backgroundColor: palette['surface-300'], color: palette.ink },
            ]}
          >
            Return to sign-in
          </Link>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: spacing['space-6'] },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: spacing['space-4'] },
  link: {
    minHeight: sizes['control-height'],
    padding: spacing['space-4'],
    borderRadius: radii['radius-md'],
    textAlign: 'center',
  },
});
