import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Provider controls stay disabled until the Clerk SDK integration is connected. */
export function ClerkSignInScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Sign in to Kinetix
        </Text>
        {['Google', ...(Platform.OS === 'ios' ? ['Apple'] : []), 'email'].map((method) => (
          <Pressable
            key={method}
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            disabled
            style={styles.method}
          >
            <Text>Continue with {method}</Text>
          </Pressable>
        ))}
        <Text accessibilityRole="alert">
          Sign-in is temporarily unavailable. Please try again later.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', backgroundColor: '#ffffff', padding: 24 },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#111111' },
  method: { borderWidth: 1, borderColor: '#aaaaaa', borderRadius: 8, padding: 12, opacity: 0.5 },
});
