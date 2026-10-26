import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

export type HomeTab = 'home' | 'workout' | 'nutrition';

export function BottomBar({
  tab,
  onSelect,
  onStart,
  canStart,
}: Readonly<{
  tab: HomeTab;
  onSelect: (tab: HomeTab) => void;
  onStart: () => void;
  canStart: boolean;
}>) {
  const p = usePalette();
  const tabs = [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'workout', icon: 'activity', label: 'Workout' },
    { id: 'nutrition', icon: 'coffee', label: 'Nutrition' },
    { id: 'progress', icon: 'bar-chart-2', label: 'Progress' },
  ] as const;
  return (
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: p['surface-200'] }}>
      <View
        accessibilityRole="tablist"
        accessibilityLabel="Main navigation"
        style={[styles.bar, { backgroundColor: p['surface-200'], borderColor: p.line }]}
      >
        {tabs.map((item, index) => (
          <React.Fragment key={item.id}>
            {index === 2 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start workout"
                accessibilityState={{ disabled: !canStart }}
                disabled={!canStart}
                onPress={onStart}
                style={({ pressed }) => [
                  styles.add,
                  { backgroundColor: p.brand, opacity: startOpacity(canStart, pressed) },
                ]}
              >
                <Feather name="plus" size={36} color={p['on-brand']} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="tab"
              aria-selected={tab === item.id}
              accessibilityLabel={item.label}
              accessibilityHint={
                item.id === 'progress' ? 'Progress is not available yet' : undefined
              }
              accessibilityState={{ selected: tab === item.id, disabled: item.id === 'progress' }}
              disabled={item.id === 'progress'}
              onPress={() => {
                if (item.id !== 'progress') onSelect(item.id);
              }}
              style={({ pressed }) => [
                styles.tab,
                { opacity: tabOpacity(item.id === 'progress', pressed) },
              ]}
            >
              <View style={[styles.icon, tab === item.id && { backgroundColor: p['brand-soft'] }]}>
                <Feather
                  name={item.icon}
                  size={24}
                  color={tab === item.id ? p['brand-ink'] : p['ink-muted']}
                />
              </View>
              <Text
                style={[
                  textStyles.label,
                  { color: tab === item.id ? p['brand-ink'] : p['ink-muted'] },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          </React.Fragment>
        ))}
      </View>
    </SafeAreaView>
  );
}
function tabOpacity(isUnavailable: boolean, pressed: boolean) {
  if (isUnavailable) return 0.55;
  return pressed ? 0.65 : 1;
}

function startOpacity(canStart: boolean, pressed: boolean) {
  if (!canStart) return 0.45;
  return pressed ? 0.65 : 1;
}

const styles = StyleSheet.create({
  bar: {
    minHeight: sizes['tab-bar-height'],
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingTop: spacing['space-2'],
    paddingHorizontal: spacing['space-1'],
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: spacing['space-1'],
    minWidth: 0,
    minHeight: sizes['tap-min'],
  },
  icon: {
    minWidth: sizes['control-height'],
    height: 36,
    borderRadius: radii['radius-pill'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    width: 72,
    height: 72,
    marginTop: -spacing['space-5'],
    borderRadius: radii['radius-pill'],
    justifyContent: 'center',
    alignItems: 'center',
  },
});
