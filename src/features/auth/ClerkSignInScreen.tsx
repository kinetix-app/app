import { useAuth, useClerk, useSignIn, useSignUp, useSSO } from '@clerk/expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/ActionButton';
import { BrandHeader } from '@/components/BrandHeader';
import { IconTextField } from '@/components/IconTextField';
import { getAccount, type Account } from '@/features/accounts/api';
import { TrainingWorkspace } from '@/features/training/TrainingWorkspace';
import { ApiError } from '@/services/apiClient';
import { authService } from '@/services/authService';
import { colors } from '@/theme/colors';

import { authStyles as styles } from './authStyles';

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

  if (account)
    return (
      <TrainingWorkspace
        accountId={account.id}
        onSignOut={() => {
          void logout();
        }}
      />
    );

  return (
    <View style={styles.content}>
      <BrandHeader />
      {!error ? (
        <ActivityIndicator accessibilityLabel="Connecting your account" color={colors.accent} />
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {error && !leaving ? (
        <ActionButton
          title="Retry connection"
          icon="refresh"
          onPress={() => {
            setError('');
            setAttempt((value) => value + 1);
          }}
          style={styles.primaryAction}
        />
      ) : null}
      <ActionButton
        title="Sign out"
        variant="outline"
        icon="log-out-outline"
        iconPosition="start"
        disabled={leaving}
        onPress={() => {
          void logout();
        }}
        style={error && !leaving ? styles.secondaryAction : styles.primaryAction}
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
      <BrandHeader />
      <View style={styles.heading}>
        <Text style={styles.title}>{creating ? 'Create your account' : 'Sign in to continue'}</Text>
        <Text style={styles.subtitle}>Your fitness journey starts here.</Text>
      </View>
      <Text style={styles.label}>Email</Text>
      <IconTextField
        icon="mail-outline"
        accessibilityLabel="Email"
        placeholder="Enter your email"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!pending && !sent}
      />
      {sent ? (
        <>
          <Text style={styles.label}>Enter the verification code from your email.</Text>
          <IconTextField
            icon="keypad-outline"
            accessibilityLabel="Email verification code"
            placeholder="Verification code"
            autoComplete="one-time-code"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            editable={!pending}
          />
          <View style={styles.linkRow}>
            <Pressable
              accessibilityRole="button"
              disabled={pending}
              onPress={() => {
                setSent(false);
                setCode('');
                setError('');
              }}
            >
              <Text style={styles.link}>Use another email</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: pending || cooldown }}
              disabled={pending || cooldown}
              onPress={() => {
                void sendCode();
              }}
            >
              <Text style={[styles.link, cooldown && { color: colors.textMuted }]}>
                {cooldown ? 'Resend available in 30 seconds' : 'Resend code'}
              </Text>
            </Pressable>
          </View>
          <ActionButton
            title="Verify code"
            icon="arrow-forward"
            disabled={pending}
            onPress={() => {
              void verifyCode();
            }}
            style={styles.primaryAction}
          />
        </>
      ) : (
        <ActionButton
          title="Send email code"
          icon="arrow-forward"
          disabled={pending}
          onPress={() => {
            void sendCode();
          }}
          style={styles.primaryAction}
        />
      )}
      {pending ? (
        <ActivityIndicator
          accessibilityLabel="Authenticating"
          color={colors.accent}
          style={styles.status}
        />
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
        <View style={styles.divider} />
      </View>
      <View style={styles.socialRow}>
        <ActionButton
          title="Google"
          accessibilityLabel="Continue with Google"
          variant="outline"
          icon="logo-google"
          iconPosition="start"
          disabled={pending}
          onPress={() => {
            void social('oauth_google');
          }}
          style={styles.socialButton}
        />
        <ActionButton
          title="Apple"
          accessibilityLabel="Continue with Apple"
          variant="outline"
          icon="logo-apple"
          iconPosition="start"
          disabled={pending}
          onPress={() => {
            void social('oauth_apple');
          }}
          style={styles.socialButton}
        />
      </View>
      {sent ? null : (
        <Pressable
          accessibilityRole="button"
          disabled={pending}
          onPress={() => {
            setCreating(!creating);
            setCode('');
            setError('');
          }}
          style={styles.footer}
        >
          <Text style={styles.footerText}>
            {creating ? 'Already have an account? ' : 'New here? '}
            <Text style={styles.link}>{creating ? 'Sign in' : 'Create account'}</Text>
          </Text>
        </Pressable>
      )}
      <Text style={styles.terms}>
        By continuing, you agree to our Terms of Service
        {'\n'}and Privacy Policy.
      </Text>
    </View>
  );
}

export function ClerkSignInScreen() {
  const { isLoaded, isSignedIn, sessionId } = useAuth();
  if (isLoaded && isSignedIn) return <ConnectedAccount key={sessionId} />;
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!isLoaded ? (
            <ActivityIndicator accessibilityLabel="Restoring session" color={colors.accent} />
          ) : (
            <SignInForm />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
