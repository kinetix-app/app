import React from 'react';
import { sizes, usePalette } from '@/theme/tokens';
import type { MacroRangeProps } from './MacroRange';

export function MacroRange({ label, value, disabled, onChange, onBlur }: MacroRangeProps) {
  const p = usePalette();
  return (
    <input
      type="range"
      aria-label={label}
      min={0}
      max={100}
      step={0.01}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
      onBlur={onBlur}
      style={{ width: '100%', minHeight: sizes['tap-min'], margin: 0, accentColor: p.brand }}
    />
  );
}
