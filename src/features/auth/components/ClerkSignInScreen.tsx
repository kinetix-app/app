import {
  isClerkAPIResponseError,
  useAuth,
  useClerk,
  useSignIn,
  useSignUp,
  useSSO,
} from '@clerk/expo';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as AuthSession from 'expo-auth-session';
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
import { TextField } from '@/components/TextField';
import { getAccount, type Account } from '@/features/accounts/api';
import { HomeScreen } from '@/features/home';
import { ApiError } from '@/services/apiClient';
import { authService } from '@/services/authService';
import { colors } from '@/theme/colors';

import { AccountConnectionScreen } from './AccountConnectionScreen';
import { authStyles as styles } from './authStyles';

/** Private state is mounted per Clerk session and discarded on expiry/account change. */
function ConnectedAccount({ initialTab }: Readonly<{ initialTab: 'home' | 'nutrition' }>) {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const request = useRef<AbortController | null>(null);
  const tokenGetter = useRef(getToken);

  // Expo returns a new wrapper each render. Keep tokens current without reconnecting.
  useEffect(() => {
    tokenGetter.current = getToken;
  }, [getToken]);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    authService.setTokenProvider(() => tokenGetter.current());
    void getAccount(undefined, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setAccount(result);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(getAccountError(cause));
      });
    return () => {
      controller.abort();
      authService.clear();
    };
  }, [attempt]);

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
      <HomeScreen
        initialTab={initialTab}
        accountId={account.id}
        initialAccount={account}
        onSignOut={() => {
          void logout();
        }}
      />
    );

  return (
    <AccountConnectionScreen
      error={error}
      leaving={leaving}
      onRetry={() => {
        setError('');
        setAttempt((value) => value + 1);
      }}
      onSignOut={() => {
        void logout();
      }}
    />
  );
}

function getAccountError(cause: unknown) {
  if (cause instanceof ApiError && cause.status === 401)
    return 'Your session was not accepted. Sign out and try again.';
  if (cause instanceof ApiError && cause.status === 403) return 'Account access denied.';
  return 'Unable to connect your account. Check your connection and try again.';
}

function SignInForm() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
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
      if (!sent) {
        const result = await signIn.create({
          identifier: email.trim(),
          signUpIfMissing: true,
        });
        if (result.error) throw result.error;
      }
      const result = await signIn.emailCode.sendCode();
      if (result.error) throw result.error;
      setSent(true);
      setCode('');
      setCooldown(true);
    }, 'Unable to send a code. Check your email and connection, then try again.');
  }

  async function verifyCode() {
    if (!signIn || !signUp || !code.trim()) {
      setError('Enter the code from your email.');
      return;
    }
    await perform(async () => {
      const result = await signIn.emailCode.verifyCode({ code: code.trim() });
      if (
        result.error &&
        isClerkAPIResponseError(result.error) &&
        result.error.errors.some((item) => item.code === 'sign_up_if_missing_transfer')
      ) {
        const transferred = await signUp.create({ transfer: true });
        if (transferred.error) throw transferred.error;
        if (signUp.status !== 'complete') {
          throw new Error('Additional account information is required to finish sign-up.');
        }
        const completed = await signUp.finalize();
        if (completed.error) throw completed.error;
        return;
      }

      if (result.error) throw result.error;
      if (signIn.status !== 'complete') {
        throw new Error('Additional account verification is required.');
      }
      const completed = await signIn.finalize();
      if (completed.error) throw completed.error;
    }, 'The code was not accepted or sign-in could not finish. Try again or request a new code.');
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
        <Text style={styles.title}>Enter your email to get started</Text>
        <Text style={styles.subtitle}>Your fitness journey starts here.</Text>
      </View>
      <Text style={styles.label}>Email</Text>
      <TextField
        theme="dark"
        leading={<Ionicons name="mail-outline" size={20} color={colors.icon} />}
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
          <TextField
            theme="dark"
            leading={<Ionicons name="keypad-outline" size={20} color={colors.icon} />}
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
      <Text style={styles.terms}>
        By continuing, you agree to our Terms of Service
        {'\n'}and Privacy Policy.
      </Text>
    </View>
  );
}

export function ClerkSignInScreen({
  initialTab = 'home',
}: Readonly<{ initialTab?: 'home' | 'nutrition' }>) {
  const { isLoaded, isSignedIn, sessionId } = useAuth();
  if (isLoaded && isSignedIn) return <ConnectedAccount initialTab={initialTab} key={sessionId} />;
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
