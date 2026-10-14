import { useEffect, useRef, useState } from 'react';
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

export function DevelopmentSignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        setError(
          cause instanceof ApiError && cause.status === 401
            ? 'The email or password was not accepted.'
            : 'Unable to sign in. Check your connection and try again.',
        );
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
    setError('');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <Text accessibilityRole="header" style={styles.title}>
              Kinetix
            </Text>
            {account ? (
              <>
                <Text style={styles.subtitle}>
                  Welcome{account.profile.display_name ? `, ${account.profile.display_name}` : ''}.
                </Text>
                <Text>Your account is connected.</Text>
                <Button title="Sign out" onPress={signOut} />
              </>
            ) : (
              <>
                <Text style={styles.subtitle}>Development sign-in</Text>
                <Text nativeID="email-label">Email</Text>
                <TextInput
                  accessibilityLabel="Email"
                  accessibilityLabelledBy="email-label"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  editable={!pending}
                  style={styles.input}
                />
                <Text nativeID="password-label">Password</Text>
                <TextInput
                  accessibilityLabel="Password"
                  accessibilityLabelledBy="password-label"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  editable={!pending}
                  onSubmitEditing={() => {
                    void signIn();
                  }}
                  style={styles.input}
                />
                {error ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {error}
                  </Text>
                ) : null}
                {pending ? <ActivityIndicator accessibilityLabel="Signing in" /> : null}
                <Button
                  title="Sign in"
                  disabled={pending}
                  onPress={() => {
                    void signIn();
                  }}
                />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  form: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 12 },
  title: { fontSize: 36, fontWeight: '700', color: '#111111' },
  subtitle: { fontSize: 22, color: '#111111' },
  input: { borderWidth: 1, borderColor: '#777777', borderRadius: 8, padding: 12, fontSize: 16 },
  error: { color: '#a00000' },
});
