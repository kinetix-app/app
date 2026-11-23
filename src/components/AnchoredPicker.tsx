import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { radii, shadows, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

type Anchor = { x: number; y: number; width: number; height: number };

const maxMenuHeight = 248;
const gap = spacing['space-2'];
const margin = spacing['space-4'];

export type PickerOption<Value> = { value: Value; label: string; detail?: string };

export function AnchoredPicker<Value extends string | number | null>({
  selection,
  options,
  onSelect,
  labelPrefix,
  fallbackLabel,
  closeLabel,
  menuTestId,
  icon,
  disabled = false,
  menuFooter,
}: Readonly<{
  selection: Value;
  options: readonly PickerOption<Value>[];
  onSelect: (selection: Value) => void;
  labelPrefix: string;
  fallbackLabel: string;
  closeLabel: string;
  menuTestId?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  menuFooter?: React.ReactNode;
}>) {
  const p = usePalette();
  const viewport = useWindowDimensions();
  const trigger = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [closing, setClosing] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [progress] = useState(() => new Animated.Value(0));
  const expanded = anchor !== null && !closing;
  const selected = options.find((option) => option.value === selection);
  const label = selected?.label ?? fallbackLabel;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      subscription.remove();
      progress.stopAnimation();
    };
  }, [progress]);

  function animate(value: number, duration: number) {
    return Animated.timing(progress, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
  }

  function openMenu() {
    trigger.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      progress.setValue(reduceMotion ? 1 : 0);
      setClosing(false);
      setAnchor({ x, y, width, height });
    });
  }

  function closeMenu() {
    if (closing) return;
    setClosing(true);
    if (reduceMotion) {
      setAnchor(null);
      return;
    }
    animate(0, 130).start(({ finished }) => {
      if (finished) setAnchor(null);
    });
  }

  const spaceAbove = (anchor?.y ?? 0) - gap - margin;
  const spaceBelow = viewport.height - (anchor ? anchor.y + anchor.height : 0) - gap - margin;
  const above = spaceBelow < maxMenuHeight && spaceAbove > spaceBelow;
  const width = Math.min(anchor?.width ?? 0, viewport.width - margin * 2);

  return (
    <>
      <Pressable
        ref={trigger}
        accessibilityRole="button"
        accessibilityLabel={`${labelPrefix}: ${label}`}
        accessibilityHint={selected?.detail}
        accessibilityState={{ expanded, disabled }}
        disabled={disabled}
        aria-expanded={expanded}
        onPress={openMenu}
        style={({ pressed }) => [
          styles.row,
          {
            minHeight: sizes['control-height'],
            padding: spacing['space-3'],
            borderColor: p.line,
            borderWidth: 1,
            borderRadius: radii['radius-lg'],
            backgroundColor: pressed ? p['surface-300'] : p['surface-200'],
          },
        ]}
      >
        <View
          style={{
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radii['radius-md'],
            backgroundColor: p['surface-300'],
          }}
        >
          <Ionicons name={icon} size={19} color={p['ink-muted']} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[textStyles.label, { color: p.ink }]}>{label}</Text>
          {selected?.detail ? (
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              {selected.detail}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={p['ink-muted']}
        />
      </Pressable>
      {anchor ? (
        <Modal
          transparent
          visible
          statusBarTranslucent
          navigationBarTranslucent
          onShow={() => {
            if (expanded && !reduceMotion) animate(1, 180).start();
          }}
          onRequestClose={closeMenu}
        >
          <View
            style={{ flex: 1 }}
            accessibilityViewIsModal
            accessibilityElementsHidden={closing}
            importantForAccessibility={closing ? 'no-hide-descendants' : 'auto'}
            aria-hidden={closing}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              tabIndex={-1}
              onPress={closeMenu}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View
              testID={menuTestId}
              pointerEvents={closing ? 'none' : 'auto'}
              style={{
                position: 'absolute',
                width,
                left: Math.max(margin, Math.min(anchor.x, viewport.width - width - margin)),
                ...(above
                  ? { bottom: viewport.height - anchor.y + gap }
                  : { top: anchor.y + anchor.height + gap }),
                opacity: progress,
                transform: [
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [above ? gap : -gap, 0],
                    }),
                  },
                ],
                borderWidth: 1,
                borderRadius: radii['radius-lg'],
                borderColor: p['line-strong'],
                backgroundColor: p['surface-200'],
                boxShadow: shadows()['shadow-pop'],
              }}
            >
              <ScrollView
                style={{
                  maxHeight: Math.min(maxMenuHeight, Math.max(0, above ? spaceAbove : spaceBelow)),
                }}
                contentContainerStyle={{ padding: spacing['space-2'], gap: spacing['space-1'] }}
              >
                {options.map((option) => {
                  const checked = option.value === selection;
                  return (
                    <Pressable
                      key={String(option.value)}
                      accessibilityRole="button"
                      accessibilityLabel={option.label}
                      accessibilityHint={option.detail}
                      accessibilityState={{ selected: checked }}
                      aria-selected={checked}
                      onPress={() => {
                        onSelect(option.value);
                        closeMenu();
                      }}
                      style={({ pressed }) => [
                        styles.row,
                        {
                          minHeight: sizes['tap-min'],
                          padding: spacing['space-2'],
                          borderRadius: radii['radius-md'],
                          backgroundColor: checked || pressed ? p['surface-300'] : undefined,
                        },
                      ]}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[textStyles.label, { color: p.ink }]}>{option.label}</Text>
                        {option.detail ? (
                          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                            {option.detail}
                          </Text>
                        ) : null}
                      </View>
                      {checked ? <Ionicons name="checkmark" size={20} color={p.ink} /> : null}
                    </Pressable>
                  );
                })}
                {menuFooter}
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-3'] },
});
