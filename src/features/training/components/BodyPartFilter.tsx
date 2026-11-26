import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { selectCopy, useLanguage } from '@/i18n/Language';
import { catalogueLabel } from '../catalogueLabels';
import { Button, Failure, IconButton, Loading, ui } from './ui';

export type ActivityFilter = 'all' | 'gym' | 'cardio';
const ACTIVITY_LABELS = {
  en: { all: 'All', gym: 'Gym', cardio: 'Cardio' },
  es: { all: 'Todas', gym: 'Gimnasio', cardio: 'Cardio' },
} as const;

export function BodyPartFilter({
  selected,
  activityType,
  options,
  pending,
  error,
  retry,
  onApply,
  onClose,
}: Readonly<{
  selected: string[];
  activityType: ActivityFilter;
  options: string[];
  pending: boolean;
  error: Error | null;
  retry: () => void;
  onApply: (parts: string[], activity: ActivityFilter) => void;
  onClose: () => void;
}>) {
  const p = usePalette();
  const language = useLanguage();
  const es = language === 'es';
  const [activity, setActivity] = useState(activityType);
  const [draft, setDraft] = useState(selected);
  const selectionSummary = draft.length
    ? selectCopy(es, `${draft.length} seleccionadas`, `${draft.length} selected`)
    : selectCopy(es, 'Todas las zonas musculares', 'All body parts');
  const available = [...new Set([...selected, ...options])].sort((a, b) =>
    catalogueLabel(a, language).localeCompare(catalogueLabel(b, language), language),
  );
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: p.scrim,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing['space-4'],
        }}
      >
        <View
          accessibilityViewIsModal
          style={[
            ui.card,
            { width: '100%', maxWidth: 480, maxHeight: '85%', backgroundColor: p['surface-200'] },
          ]}
        >
          <View style={ui.row}>
            <Text
              accessibilityRole="header"
              style={[textStyles['title-md'], { color: p.ink, flex: 1 }]}
            >
              {selectCopy(es, 'Filtros', 'Filters')}
            </Text>
            <IconButton
              icon="x"
              label={selectCopy(
                es,
                'Cerrar filtros de zonas musculares',
                'Close body part filters',
              )}
              onPress={onClose}
            />
          </View>
          <View style={{ gap: spacing['space-2'] }}>
            <Text style={[textStyles.label, { color: p.ink }]}>
              {selectCopy(es, 'Actividad', 'Activity')}
            </Text>
            <View
              style={[
                ui.row,
                {
                  gap: spacing['space-1'],
                  padding: spacing['space-1'],
                  borderRadius: radii['radius-md'],
                  backgroundColor: p['surface-300'],
                },
              ]}
            >
              {(['all', 'gym', 'cardio'] as const).map((type) => (
                <Pressable
                  key={type}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activity === type }}
                  onPress={() => setActivity(type)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: sizes['tap-min'],
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radii['radius-sm'],
                    borderWidth: 1,
                    borderColor: activity === type ? p.brand : 'transparent',
                    backgroundColor: activity === type ? p['brand-soft'] : 'transparent',
                    opacity: pressed ? 0.55 : 1,
                  })}
                >
                  <Text
                    style={[
                      textStyles.label,
                      { color: activity === type ? p['brand-ink'] : p['ink-muted'] },
                    ]}
                  >
                    {ACTIVITY_LABELS[language][type]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {activity !== 'cardio' ? (
            <>
              <Text style={[textStyles.label, { color: p.ink }]}>
                {selectCopy(es, 'Zonas musculares', 'Body parts')}
              </Text>
              <ScrollView
                style={{ flexShrink: 1 }}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: spacing['space-1'] }}
              >
                {pending ? <Loading /> : null}
                {error ? <Failure error={error} retry={retry} /> : null}
                {available.map((part) => {
                  const checked = draft.includes(part);
                  const label = catalogueLabel(part, language);
                  return (
                    <Pressable
                      key={part}
                      accessibilityRole="checkbox"
                      accessibilityLabel={label}
                      accessibilityState={{ checked }}
                      aria-checked={checked}
                      onPress={() =>
                        setDraft((previous) =>
                          checked
                            ? previous.filter((value) => value !== part)
                            : [...previous, part],
                        )
                      }
                      style={({ pressed }) => [
                        ui.row,
                        {
                          minHeight: sizes['control-height'],
                          padding: spacing['space-3'],
                          borderRadius: radii['radius-md'],
                          backgroundColor: checked ? p['brand-soft'] : 'transparent',
                          opacity: pressed ? 0.55 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          textStyles.body,
                          { color: checked ? p['brand-ink'] : p.ink, flex: 1 },
                        ]}
                      >
                        {label.charAt(0).toUpperCase() + label.slice(1)}
                      </Text>
                      <Feather
                        name={checked ? 'check-square' : 'square'}
                        size={24}
                        color={checked ? p['brand-ink'] : p['ink-muted']}
                      />
                    </Pressable>
                  );
                })}
                {!pending && !error && available.length === 0 ? (
                  <Text style={{ color: p['ink-muted'] }}>
                    {selectCopy(
                      es,
                      'No hay zonas musculares disponibles.',
                      'No body parts available.',
                    )}
                  </Text>
                ) : null}
              </ScrollView>
              <View style={[ui.row, { justifyContent: 'space-between' }]}>
                <Text
                  accessibilityLiveRegion="polite"
                  style={[textStyles['body-sm'], { color: p['ink-muted'], flex: 1 }]}
                >
                  {selectionSummary}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={selectCopy(
                    es,
                    'Limpiar selección de zonas musculares',
                    'Clear draft body part filters',
                  )}
                  accessibilityState={{ disabled: draft.length === 0 }}
                  disabled={draft.length === 0}
                  onPress={() => setDraft([])}
                  style={({ pressed }) => ({
                    minHeight: sizes['tap-min'],
                    paddingHorizontal: spacing['space-2'],
                    justifyContent: 'center',
                    opacity: pressed || !draft.length ? 0.55 : 1,
                  })}
                >
                  <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
                    {selectCopy(es, 'Limpiar', 'Clear')}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}
          <View style={ui.row}>
            <View style={{ flex: 1 }}>
              <Button title={selectCopy(es, 'Cancelar', 'Cancel')} onPress={onClose} secondary />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={selectCopy(es, 'Guardar', 'Save')}
                accessibilityLabel={selectCopy(es, 'Guardar filtros', 'Save filters')}
                onPress={() =>
                  onApply(
                    activity === 'cardio' ? [] : [...draft].sort((a, b) => a.localeCompare(b)),
                    activity,
                  )
                }
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
