import Ionicons from '@expo/vector-icons/Ionicons';
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
import { getApiBaseUrl } from '@/config/environment';
import { getAccount, type Account } from '@/features/accounts/api';
import { ApiError } from '@/services/apiClient';
import { authService } from '@/services/authService';
import { colors } from '@/theme/colors';

import { authStyles as styles } from './authStyles';

export function DevelopmentSignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const request = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      request.current?.abort();
      authService.clear();
    },
    [],
  );

  async function signIn() {
    if (request.current) return;
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (!getApiBaseUrl()) {
      setError('Set EXPO_PUBLIC_API_URL to your backend address, then restart the app.');
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError('');
    try {
      authService.setBasicCredentials(email.trim(), password);
      const result = await getAccount(undefined, controller.signal);
      if (!controller.signal.aborted) {
        setAccount(result);
        setPassword('');
      }
    } catch (cause) {
      authService.clear();
      if (!controller.signal.aborted) {
        if (cause instanceof ApiError) {
          if (cause.status === 401 && cause.authScheme?.toLowerCase().startsWith('bearer')) {
            setError(
              'The API is using Clerk. Set backend AUTH_MODE=basic for development sign-in.',
            );
          } else if (cause.status === 401) {
            setError(
              'The email or password was not accepted. Use an account configured on the backend.',
            );
          } else if (cause.status === 403) {
            setError('Account access denied.');
          } else {
            setError(`The API returned an error (${cause.status}). Check the backend service.`);
          }
        } else {
          setError(
            'Unable to reach the API or read its response. Check the backend address and connection.',
          );
        }
      }
    } finally {
      if (!controller.signal.aborted) setPending(false);
      request.current = null;
    }
  }

  function signOut() {
    authService.clear();
    setAccount(null);
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setError('');
  }

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
          <View style={styles.content}>
            <BrandHeader />
            {account ? (
              <>
                <View style={styles.heading}>
                  <Text style={styles.title}>
                    Welcome
                    {account.profile.display_name ? `, ${account.profile.display_name}` : ''}.
                  </Text>
                  <Text style={styles.subtitle}>Your account is connected.</Text>
                </View>
                <ActionButton
                  title="Sign out"
                  variant="outline"
                  icon="log-out-outline"
                  iconPosition="start"
                  onPress={signOut}
                  style={styles.primaryAction}
                />
              </>
            ) : (
              <>
                <View style={styles.heading}>
                  <Text style={styles.title}>Sign in to continue</Text>
                  <Text style={styles.subtitle}>Development sign-in</Text>
                </View>
                <Text nativeID="email-label" style={styles.label}>
                  Email
                </Text>
                <IconTextField
                  icon="mail-outline"
                  accessibilityLabel="Email"
                  accessibilityLabelledBy="email-label"
                  placeholder="Enter your email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  editable={!pending}
                />
                <Text nativeID="password-label" style={styles.label}>
                  Password
                </Text>
                <IconTextField
                  icon="lock-closed-outline"
                  accessibilityLabel="Password"
                  accessibilityLabelledBy="password-label"
                  placeholder="Enter your password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  editable={!pending}
                  onSubmitEditing={() => {
                    void signIn();
                  }}
                  trailing={
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      hitSlop={8}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={21}
                        color={colors.icon}
                      />
                    </Pressable>
                  }
                />
                {error ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {error}
                  </Text>
                ) : null}
                {pending ? (
                  <ActivityIndicator
                    accessibilityLabel="Signing in"
                    color={colors.accent}
                    style={styles.status}
                  />
                ) : null}
                <ActionButton
                  title="Sign in"
                  icon="arrow-forward"
                  disabled={pending}
                  onPress={() => {
                    void signIn();
                  }}
                  style={styles.primaryAction}
                />
                <Text style={styles.terms}>
                  By continuing, you agree to our Terms of Service
                  {'\n'}and Privacy Policy.
                </Text>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
