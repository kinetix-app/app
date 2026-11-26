import { getTranslation } from '@/i18n/catalog';
import { useLanguage } from '@/i18n/Language';
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
  const language = useLanguage();
  return (
    <AnchoredPicker
      selection={selection}
      options={options}
      onSelect={onSelect}
      labelPrefix={getTranslation(language)('leagues.selectRound')}
      fallbackLabel={getTranslation(language)('leagues.chooseARound')}
      closeLabel={getTranslation(language)('leagues.closeRoundMenu')}
      menuTestId="league-round-menu"
      icon="calendar-outline"
    />
  );
}
