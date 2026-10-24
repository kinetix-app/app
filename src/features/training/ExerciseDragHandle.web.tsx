import React from 'react';
import { usePalette } from '@/theme/tokens';
import type { DragHandleProps } from './ExerciseDragHandle';

export function ExerciseDragHandle({ id, label, disabled, onMove }: DragHandleProps) {
  const p = usePalette();
  return (
    <button
      type="button"
      id={id}
      aria-label={label}
      title="Drag to reorder; use arrow keys to move"
      disabled={disabled}
      onDragStart={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          onMove(event.key === 'ArrowUp' ? -1 : 1);
        }
      }}
      style={{
        minHeight: 44,
        width: 44,
        border: 0,
        background: 'transparent',
        color: p['ink-muted'],
        fontSize: 28,
        cursor: disabled ? 'default' : 'grab',
        touchAction: 'none',
      }}
    >
      ≡
    </button>
  );
}
