import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, textStyles, usePalette } from '@/theme/tokens';

/** Shared title treatment for the main Home, Workout and Nutrition screens. */
export function ScreenHeader({
  title,
  leading,
  children,
}: React.PropsWithChildren<{
  title: string;
  leading?: React.ReactNode;
}>) {
  const p = usePalette();
  return (
    <View style={styles.header}>
      {leading}
      <Text
        accessibilityRole="header"
        style={[textStyles['display-lg'], { flex: 1, color: p.ink }]}
      >
        {title}
      </Text>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['space-3'] },
  actions: { alignSelf: 'center' },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: spacing['space-4'],
    paddingTop: spacing['space-8'],
  },
});
export const screenContentStyle = styles.content;
