import React, { useEffect, useState } from 'react';
import { Animated, Pressable, Text } from 'react-native';
import { usePalette } from '@/theme/tokens';

export function AnimatedTextSelector({
  label,
  selected,
  role,
  reduceMotion,
  onPress,
  equalWidth = false,
}: Readonly<{
  label: string;
  selected: boolean;
  role: 'tab' | 'button';
  reduceMotion: boolean;
  onPress: () => void;
  equalWidth?: boolean;
}>) {
  const p = usePalette();
  const [progress] = useState(() => new Animated.Value(selected ? 1 : 0));
  useEffect(() => {
    const transition = Animated.timing(progress, {
      toValue: selected ? 1 : 0,
      duration: reduceMotion ? 0 : 220,
      useNativeDriver: true,
    });
    transition.start();
    return () => transition.stop();
  }, [selected, reduceMotion, progress]);
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ selected }}
      aria-selected={selected}
      onPress={onPress}
      style={{
        minHeight: 44,
        justifyContent: 'center',
        ...(equalWidth ? { flex: 1, alignItems: 'center' } : {}),
      }}
    >
      <Text style={{ color: selected ? p.brand : p.ink }}>{label}</Text>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: p.brand,
          opacity: progress,
          transform: [
            { scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
          ],
        }}
      />
    </Pressable>
  );
}
