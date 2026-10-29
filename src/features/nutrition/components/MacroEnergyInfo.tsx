import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

type Props = Readonly<{ label: string; factor: number }>;
type Anchor = { centerX: number; top: number; bottom: number };
const arrowSize = spacing['space-3'];

export function MacroEnergyInfo({ label, factor }: Props) {
  const p = usePalette();
  const { width, height } = useWindowDimensions();
  const anchor = React.useRef<View>(null);
  const [position, setPosition] = React.useState<Anchor | null>(null);
  const [tooltipHeight, setTooltipHeight] = React.useState(72);
  const margin = spacing['space-4'];
  const gap = spacing['space-3'];
  const tooltipWidth = Math.min(280, width - margin * 2);
  const left = Math.max(
    margin,
    Math.min((position?.centerX ?? 0) - tooltipWidth / 2, width - tooltipWidth - margin),
  );
  const above = Boolean(position && position.bottom + gap + tooltipHeight > height - margin);
  const top = position
    ? above
      ? Math.max(margin, position.top - gap - tooltipHeight)
      : position.bottom + gap
    : 0;
  const arrowLeft = Math.max(
    radii['radius-md'],
    Math.min(
      (position?.centerX ?? 0) - left - arrowSize / 2,
      tooltipWidth - radii['radius-md'] - arrowSize,
    ),
  );
  return (
    <>
      <Pressable
        ref={anchor}
        accessibilityRole="button"
        accessibilityLabel={`${label} calories per gram`}
        accessibilityState={{ expanded: position !== null }}
        onPress={() => {
          anchor.current?.measureInWindow((x, y, anchorWidth, anchorHeight) => {
            setPosition({ centerX: x + anchorWidth / 2, top: y, bottom: y + anchorHeight });
          });
        }}
        style={styles.trigger}
      >
        <Feather name="info" size={18} color={p['ink-muted']} />
      </Pressable>
      {position ? (
        <Modal transparent visible onRequestClose={() => setPosition(null)}>
          <View style={styles.overlay} accessibilityViewIsModal>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close macro information"
              onPress={() => setPosition(null)}
              style={StyleSheet.absoluteFill}
            />
            <View
              onLayout={({ nativeEvent }) => setTooltipHeight(nativeEvent.layout.height)}
              style={[
                styles.tooltip,
                {
                  width: tooltipWidth,
                  top,
                  left,
                  backgroundColor: p['surface-300'],
                  borderColor: p['line-strong'],
                },
              ]}
            >
              <View
                pointerEvents="none"
                accessible={false}
                style={[
                  styles.arrow,
                  {
                    left: arrowLeft,
                    backgroundColor: p['surface-300'],
                    borderColor: p['line-strong'],
                  },
                  above ? styles.arrowBelow : styles.arrowAbove,
                ]}
              />
              <Text style={[textStyles.body, { color: p.ink }]}>
                {label}: {factor} kcal per gram.
              </Text>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minWidth: sizes['tap-min'],
    minHeight: sizes['tap-min'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: { flex: 1 },
  tooltip: {
    position: 'absolute',
    padding: spacing['space-3'],
    borderRadius: radii['radius-md'],
    borderWidth: 1,
  },
  arrow: {
    position: 'absolute',
    width: arrowSize,
    height: arrowSize,
    transform: [{ rotate: '45deg' }],
  },
  arrowAbove: { top: -arrowSize / 2 - 1, borderTopWidth: 1, borderLeftWidth: 1 },
  arrowBelow: { bottom: -arrowSize / 2 - 1, borderBottomWidth: 1, borderRightWidth: 1 },
});
