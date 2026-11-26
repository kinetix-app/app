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
      labelPrefix={language === 'es' ? 'Seleccionar ronda' : 'Select round'}
      fallbackLabel={language === 'es' ? 'Elige una ronda' : 'Choose a round'}
      closeLabel={language === 'es' ? 'Cerrar menú de rondas' : 'Close round menu'}
      menuTestId="league-round-menu"
      icon="calendar-outline"
    />
  );
}
