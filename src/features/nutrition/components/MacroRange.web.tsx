import React from 'react';
import { sizes, usePalette } from '@/theme/tokens';
import type { MacroRangeProps } from './MacroRange';

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
    <input
      type="range"
      aria-label={label}
      min={0}
      max={maximum}
      step={0.01}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
      onBlur={onBlur}
      style={{ width: '100%', minHeight: sizes['tap-min'], margin: 0, accentColor: p.brand }}
    />
  );
}
