import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { LeagueDialog } from './LeagueDialog';
import { LeagueDropdownTrigger, leagueStyles } from './LeagueUI';

export type RoundSelection = 'current' | number;

export function LeagueRoundPicker({
  selection,
  options,
  onSelect,
}: Readonly<{
  selection: RoundSelection;
  options: { value: RoundSelection; label: string; detail?: string }[];
  onSelect: (selection: RoundSelection) => void;
}>) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === selection);
  return (
    <>
      <LeagueDropdownTrigger
        label={`Select round: ${selected?.label ?? 'Choose a round'}`}
        value={selected?.label ?? 'Choose a round'}
        detail={selected?.detail}
        icon="calendar-outline"
        expanded={open}
        onPress={() => setOpen(true)}
      />
      {open ? (
        <LeagueDialog title="Select round" onClose={() => setOpen(false)}>
          <ScrollView style={{ flexGrow: 0, maxHeight: 360 }} keyboardShouldPersistTaps="handled">
            {options.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: option.value === selection }}
                aria-selected={option.value === selection}
                onPress={() => {
                  onSelect(option.value);
                  setOpen(false);
                }}
                style={[
                  leagueStyles.row,
                  { minHeight: sizes['tap-min'], padding: spacing['space-2'] },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[textStyles.label, { color: p.ink }]}>{option.label}</Text>
                  {option.detail ? (
                    <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                      {option.detail}
                    </Text>
                  ) : null}
                </View>
                {option.value === selection ? (
                  <Ionicons name="checkmark" size={20} color={p.brand} />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </LeagueDialog>
      ) : null}
    </>
  );
}
