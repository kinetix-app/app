import React from 'react';
import { AnchoredPicker, type PickerOption } from '@/components/AnchoredPicker';

export type RoundSelection = 'current' | number | null;

export function LeagueRoundPicker({
  selection,
  options,
  onSelect,
}: Readonly<{
  selection: RoundSelection;
  options: PickerOption<RoundSelection>[];
  onSelect: (selection: RoundSelection) => void;
}>) {
  return (
    <AnchoredPicker
      selection={selection}
      options={options}
      onSelect={onSelect}
      labelPrefix="Select round"
      fallbackLabel="Choose a round"
      closeLabel="Close round menu"
      menuTestId="league-round-menu"
      icon="calendar-outline"
    />
  );
}
