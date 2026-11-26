import { getTranslation } from '@/i18n/catalog';
import React from 'react';
import { useLanguage } from '@/i18n/Language';
import { usePalette } from '@/theme/tokens';
import type { DragHandleProps } from './ExerciseDragHandle';

export function ExerciseDragHandle({ id, label, disabled, onMove }: Readonly<DragHandleProps>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <button
      type="button"
      id={id}
      aria-label={label}
      title={getTranslation(es)('training.dragToReorderUseArrowKeysTo_835b9f')}
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
