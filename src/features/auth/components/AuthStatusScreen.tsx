import Ionicons from '@expo/vector-icons/Ionicons';
import React, { type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

type AuthStatusScreenProps = Readonly<{
  title: string;
  description?: string;
  failed?: boolean;
  loadingLabel?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  children?: ReactNode;
}>;

export function AuthStatusScreen({
  title,
  description,
  failed = false,
  loadingLabel,
  icon = 'open-outline',
  children,
}: AuthStatusScreenProps) {
  const palette = usePalette();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette['surface-100'] }]}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.content}>
          <View style={styles.brand}>
            <View style={[styles.brandMark, { backgroundColor: palette.brand }]}>
              <Text
                style={[
                  textStyles['display-lg'],
                  styles.brandLetter,
                  { color: palette['on-brand'] },
                ]}
                accessible={false}
              >
                K
              </Text>
            </View>
            <Text style={[textStyles['title-lg'], styles.wordmark, { color: palette.ink }]}>
              Kinetix
            </Text>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: palette['surface-200'], borderColor: palette.line },
            ]}
          >
            <View
              style={[
                styles.statusIcon,
                { backgroundColor: palette[failed ? 'surface-300' : 'brand-soft'] },
              ]}
              accessible={false}
            >
              {loadingLabel ? (
                <ActivityIndicator
                  accessibilityLabel={loadingLabel}
                  color={palette['brand-ink']}
                  size="large"
                />
              ) : (
                <Ionicons
                  accessible={false}
                  name={failed ? 'alert-circle-outline' : icon}
                  size={32}
                  color={palette[failed ? 'danger' : 'brand-ink']}
                />
              )}
            </View>

            <View style={styles.message}>
              <Text
                accessibilityRole="header"
                style={[textStyles['title-lg'], styles.centered, { color: palette.ink }]}
              >
                {title}
              </Text>
              {description ? (
                <Text
                  accessibilityRole={failed ? 'alert' : undefined}
                  accessibilityLiveRegion="polite"
                  style={[textStyles.body, styles.centered, { color: palette['ink-muted'] }]}
                >
                  {description}
                </Text>
              ) : null}
            </View>

            {children}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing['space-4'],
    paddingVertical: spacing['space-10'],
  },
  content: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: spacing['space-8'],
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['space-3'],
  },
  brandMark: {
    width: sizes['tap-min'],
    height: sizes['tap-min'],
    borderRadius: radii['radius-md'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandLetter: { fontStyle: 'italic' },
  wordmark: { fontWeight: '700' },
  card: {
    borderWidth: 1,
    borderRadius: radii['radius-xl'],
    padding: spacing['space-6'],
    gap: spacing['space-6'],
    alignItems: 'center',
  },
  statusIcon: {
    width: spacing['space-10'] + spacing['space-8'],
    height: spacing['space-10'] + spacing['space-8'],
    borderRadius: radii['radius-pill'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: { gap: spacing['space-3'], alignItems: 'center', width: '100%' },
  centered: { textAlign: 'center' },
});
