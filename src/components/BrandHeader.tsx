import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

export function BrandHeader() {
  return (
    <View style={styles.container}>
      <Text style={styles.letter} importantForAccessibility="no" accessibilityElementsHidden>
        K
      </Text>
      <Text accessibilityRole="header" style={styles.title}>
        Kinetix
      </Text>
      <Text style={styles.tagline}>Stronger. Better. Every day.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginBottom: 38 },
  letter: { color: colors.accent, fontSize: 76, fontWeight: '900', fontStyle: 'italic' },
  title: {
    color: colors.textPrimary,
    fontSize: 33,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 4,
  },
  tagline: { color: colors.icon, fontSize: 12, marginTop: 8 },
});
