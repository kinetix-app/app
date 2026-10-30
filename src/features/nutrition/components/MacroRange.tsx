import Slider from '@react-native-community/slider';
import React from 'react';
import { sizes, usePalette } from '@/theme/tokens';

export type MacroRangeProps = Readonly<{
  label: string;
  value: number;
  maximum?: number;
  disabled: boolean;
  onChange: (value: number) => void;
  onBlur: () => void;
}>;

export function MacroRange({
  label,
  value,
  maximum = 100,
  disabled,
  onChange,
  onBlur,
}: MacroRangeProps) {
  const p = usePalette();
  return (
    <Slider
      accessibilityLabel={label}
      minimumValue={0}
      maximumValue={maximum}
      step={0.01}
      value={value}
      onValueChange={onChange}
      onSlidingComplete={onBlur}
      disabled={disabled}
      tapToSeek
      minimumTrackTintColor={p.brand}
      maximumTrackTintColor={p['line-strong']}
      thumbTintColor={p.brand}
      style={{ width: '100%', minHeight: sizes['tap-min'] }}
    />
  );
}
