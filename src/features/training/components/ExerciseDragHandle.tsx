import React from 'react';
import { useLanguage } from '@/i18n/Language';
import { Pressable, Text } from 'react-native';
import { usePalette } from '@/theme/tokens';

export type DragHandleProps = {
  id: string;
  label: string;
  disabled: boolean;
  onDrag: () => void;
  onMove: (delta: number) => void;
};
export function ExerciseDragHandle({
  id,
  label,
  disabled,
  onDrag,
  onMove,
}: Readonly<DragHandleProps>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <Pressable
      nativeID={id}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint={
        es
          ? 'Mantén pulsado y arrastra para cambiar el orden'
          : 'Hold and drag to change exercise order'
      }
      accessibilityActions={[
        { name: 'increment', label: es ? 'Mover hacia abajo' : 'Move later' },
        { name: 'decrement', label: es ? 'Mover hacia arriba' : 'Move earlier' },
      ]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (!disabled) onMove(nativeEvent.actionName === 'increment' ? 1 : -1);
      }}
      disabled={disabled}
      onLongPress={onDrag}
      delayLongPress={180}
      style={{ minHeight: 44, width: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: p['ink-muted'], fontSize: 28 }}>≡</Text>
    </Pressable>
  );
}
