import { Redirect, Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

import { AuthStatusScreen } from './AuthStatusScreen';

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

  const failed = status === 'failed';
  const messages = {
    failed: {
      title: 'Couldn’t finish sign-in',
      description: 'Close this window and retry in your original tab.',
    },
    success: {
      title: 'Return to your original tab',
      description: 'This window will close automatically.',
    },
    completing: { title: 'Finishing sign-in…', description: undefined },
  };
  const { title, description } = messages[status];

  return (
    <AuthStatusScreen
      title={title}
      failed={failed}
      loadingLabel={status === 'completing' ? 'Finishing sign-in' : undefined}
      description={description}
    >
      {failed ? (
        <Link
          href="/"
          replace
          style={[
            styles.link,
            textStyles.label,
            { backgroundColor: palette.brand, color: palette['on-brand'] },
          ]}
        >
          Return to sign-in
        </Link>
      ) : null}
    </AuthStatusScreen>
  );
}

const styles = StyleSheet.create({
  link: {
    width: '100%',
    minHeight: sizes['control-height'],
    paddingVertical: spacing['space-4'],
    paddingHorizontal: spacing['space-5'],
    borderRadius: radii['radius-md'],
    textAlign: 'center',
  },
});
