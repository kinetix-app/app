import { useAuth, useClerk, useSignIn, useSignUp, useSSO } from '@clerk/expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAccount, type Account } from '@/features/accounts/api';
import { ApiError } from '@/services/apiClient';
import { authService } from '@/services/authService';

WebBrowser.maybeCompleteAuthSession();

/** Private state is mounted per Clerk session and discarded on expiry/account change. */
function ConnectedAccount() {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    authService.setTokenProvider(getToken);
    void getAccount(undefined, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setAccount(result);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof ApiError && cause.status === 401
            ? 'Your session was not accepted. Sign out and try again.'
            : cause instanceof ApiError && cause.status === 403
              ? 'Account access denied.'
              : 'Unable to connect your account. Check your connection and try again.',
        );
      });
    return () => {
      controller.abort();
      authService.clear();
    };
  }, [getToken, attempt]);

  async function logout() {
    if (leaving) return;
    setLeaving(true);
    request.current?.abort();
    authService.clear();
    setAccount(null);
    setError('');
    try {
      await signOut();
    } catch {
      setError('Sign-out could not finish. Check your connection and try again.');
      setLeaving(false);
    }
  }

  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>
        Kinetix
      </Text>
      {account ? (
        <Text>
          Welcome{account.profile.display_name ? `, ${account.profile.display_name}` : ''}. Your
          account is connected.
        </Text>
      ) : !error ? (
        <ActivityIndicator accessibilityLabel="Connecting your account" />
      ) : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      {error && !leaving ? (
        <Button
          title="Retry connection"
          onPress={() => {
            setError('');
            setAttempt((value) => value + 1);
          }}
        />
      ) : null}
      <Button
        title="Sign out"
        disabled={leaving}
        onPress={() => {
          void logout();
        }}
      />
    </View>
  );
}

function SignInForm() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(false), 30000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function perform(action: () => Promise<void>, failure: string) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await action();
    } catch {
      setError(failure);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function sendCode() {
    if (!signIn || !signUp || !email.trim()) {
      setError('Enter your email address.');
      return;
    }
    await perform(async () => {
      if (creating) {
        if (!sent) {
          const result = await signUp.create({ emailAddress: email.trim() });
          if (result.error) throw result.error;
        }
        const result = await signUp.verifications.sendEmailCode();
        if (result.error) throw result.error;
      } else {
        const result = await signIn.emailCode.sendCode({ emailAddress: email.trim() });
        if (result.error) throw result.error;
      }
      setSent(true);
      setCode('');
      setCooldown(true);
    }, 'Unable to send a code. Check your email, connection and sign-in or create-account choice, then try again.');
  }

  async function verifyCode() {
    if (!signIn || !signUp || !code.trim()) {
      setError('Enter the code from your email.');
      return;
    }
    await perform(async () => {
      const result = creating
        ? await signUp.verifications.verifyEmailCode({ code: code.trim() })
        : await signIn.emailCode.verifyCode({ code: code.trim() });
      if (result.error) throw result.error;
      const flow = creating ? signUp : signIn;
      if (flow.status !== 'complete') {
        setError('Additional account verification is required. Contact support.');
        return;
      }
      const completed = await flow.finalize();
      if (completed.error) throw completed.error;
    }, 'The code was not accepted or has expired. Try again or request a new code.');
  }

  async function social(strategy: 'oauth_google' | 'oauth_apple') {
    await perform(async () => {
      const result = await startSSOFlow({
        strategy,
        redirectUrl: AuthSession.makeRedirectUri({ scheme: 'kinetix', path: 'sso-callback' }),
      });
      if (result.createdSessionId && result.setActive) {
        await result.setActive({ session: result.createdSessionId });
      } else if (
        result.authSessionResult?.type !== 'cancel' &&
        result.authSessionResult?.type !== 'dismiss'
      ) {
        setError('Sign-in needs additional verification. Try email or contact support.');
      }
    }, 'Provider sign-in could not finish. Please try again.');
  }

  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>
        {creating ? 'Create your account' : 'Sign in to Kinetix'}
      </Text>
      <Button
        title="Continue with Google"
        disabled={pending}
        onPress={() => {
          void social('oauth_google');
        }}
      />
      <Button
        title="Continue with Apple"
        disabled={pending}
        onPress={() => {
          void social('oauth_apple');
        }}
      />
      <TextInput
        accessibilityLabel="Email"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!pending && !sent}
        style={styles.input}
      />
      {sent ? (
        <>
          <Text>Enter the verification code from your email.</Text>
          <TextInput
            accessibilityLabel="Email verification code"
            autoComplete="one-time-code"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            editable={!pending}
            style={styles.input}
          />
          <Button
            title="Verify code"
            disabled={pending}
            onPress={() => {
              void verifyCode();
            }}
          />
          <Button
            title={cooldown ? 'Resend available in 30 seconds' : 'Resend code'}
            disabled={pending || cooldown}
            onPress={() => {
              void sendCode();
            }}
          />
          <Button
            title="Use another email"
            disabled={pending}
            onPress={() => {
              setSent(false);
              setCode('');
              setError('');
            }}
          />
        </>
      ) : (
        <>
          <Button
            title="Send email code"
            disabled={pending}
            onPress={() => {
              void sendCode();
            }}
          />
          <Button
            title={creating ? 'Already have an account? Sign in' : 'New here? Create account'}
            disabled={pending}
            onPress={() => {
              setCreating(!creating);
              setCode('');
              setError('');
            }}
          />
        </>
      )}
      {pending ? <ActivityIndicator accessibilityLabel="Authenticating" /> : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function ClerkSignInScreen() {
  const { isLoaded, isSignedIn, sessionId } = useAuth();
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {!isLoaded ? (
            <ActivityIndicator accessibilityLabel="Restoring session" />
          ) : isSignedIn ? (
            <ConnectedAccount key={sessionId} />
          ) : (
            <SignInForm />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#111111' },
  input: { borderWidth: 1, borderColor: '#777777', borderRadius: 8, padding: 12, fontSize: 16 },
  error: { color: '#a00000' },
});
