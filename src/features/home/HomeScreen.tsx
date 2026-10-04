import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.introduction}>
          <Text accessibilityRole="header" style={styles.title}>
            Kinetix
          </Text>
          <Text style={styles.subtitle}>A place for your next step.</Text>
          <Text style={styles.description}>Your training space is taking shape.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Temporary scaffold styling; the product design and tokens are owned by management.
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  introduction: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: 16 },
  title: { fontSize: 40, lineHeight: 48, fontWeight: '700', color: '#111111' },
  subtitle: { fontSize: 24, lineHeight: 32, color: '#111111' },
  description: { fontSize: 16, lineHeight: 24, color: '#444444' },
});
