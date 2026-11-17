import React from 'react';
import { Text, View } from 'react-native';
import { radii, textStyles, usePalette } from '@/theme/tokens';

export function personName(name: string | null) {
  return name?.trim() || 'Kinetix athlete';
}

/** Decorative initial for another person; their name is always shown next to it. */
export function InitialAvatar({
  name,
  size = 40,
}: Readonly<{ name: string | null; size?: number }>) {
  const p = usePalette();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        width: size,
        height: size,
        borderRadius: radii['radius-pill'],
        backgroundColor: p['brand-soft'],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={[textStyles[size >= 64 ? 'metric-md' : 'label'], { color: p['brand-ink'] }]}>
        {personName(name).slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}
