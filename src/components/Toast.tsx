import { Feather } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

export function Toast({
  message,
  onDismiss,
  duration = 4000,
}: Readonly<{ message: string; onDismiss: () => void; duration?: number }>) {
  const p = usePalette();
  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
    const timeout = setTimeout(onDismiss, duration);
    return () => clearTimeout(timeout);
  }, [duration, message, onDismiss]);

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View style={[styles.toast, { backgroundColor: p['surface-200'], borderColor: p.success }]}>
        <Feather name="check-circle" color={p.success} size={20} />
        <Text
          role="status"
          accessibilityLiveRegion="polite"
          style={[styles.message, { color: p.ink }]}
        >
          {message}
        </Text>
        <Pressable
          accessibilityLabel="Dismiss notification"
          accessibilityRole="button"
          onPress={onDismiss}
          style={styles.dismiss}
        >
          <Feather name="x" color={p['ink-muted']} size={17} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: spacing['space-3'],
    left: spacing['space-4'],
    right: spacing['space-4'],
    alignItems: 'center',
    zIndex: 5,
  },
  toast: {
    width: '100%',
    maxWidth: 360,
    paddingLeft: spacing['space-3'],
    paddingRight: spacing['space-1'],
    gap: spacing['space-2'],
    borderRadius: radii['radius-md'],
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  message: { ...textStyles.label, flex: 1 },
  dismiss: {
    width: sizes['tap-min'],
    height: sizes['tap-min'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
