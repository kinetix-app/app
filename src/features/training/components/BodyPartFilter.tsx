import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { Button, Failure, IconButton, Loading, ui } from './ui';

export type ActivityFilter = 'all' | 'gym' | 'cardio';
const ACTIVITY_LABELS = { all: 'All', gym: 'Gym', cardio: 'Cardio' } as const;

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
  const [activity, setActivity] = useState(activityType);
  const [draft, setDraft] = useState(selected);
  const available = [...new Set([...selected, ...options])].sort((a, b) => a.localeCompare(b));
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
              Filters
            </Text>
            <IconButton icon="x" label="Close body part filters" onPress={onClose} />
          </View>
          <View style={{ gap: spacing['space-2'] }}>
            <Text style={[textStyles.label, { color: p.ink }]}>Activity</Text>
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
                    {ACTIVITY_LABELS[type]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {activity !== 'cardio' ? (
            <>
              <Text style={[textStyles.label, { color: p.ink }]}>Body parts</Text>
              <ScrollView
                style={{ flexShrink: 1 }}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: spacing['space-1'] }}
              >
                {pending ? <Loading /> : null}
                {error ? <Failure error={error} retry={retry} /> : null}
                {available.map((part) => {
                  const checked = draft.includes(part);
                  return (
                    <Pressable
                      key={part}
                      accessibilityRole="checkbox"
                      accessibilityLabel={part}
                      accessibilityState={{ checked }}
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
                        {part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()}
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
                  <Text style={{ color: p['ink-muted'] }}>No body parts available.</Text>
                ) : null}
              </ScrollView>
              <View style={[ui.row, { justifyContent: 'space-between' }]}>
                <Text
                  accessibilityLiveRegion="polite"
                  style={[textStyles['body-sm'], { color: p['ink-muted'], flex: 1 }]}
                >
                  {draft.length ? `${draft.length} selected` : 'All body parts'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear draft body part filters"
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
                  <Text style={[textStyles.label, { color: p['brand-ink'] }]}>Clear</Text>
                </Pressable>
              </View>
            </>
          ) : null}
          <View style={ui.row}>
            <View style={{ flex: 1 }}>
              <Button title="Cancel" onPress={onClose} secondary />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Save"
                accessibilityLabel="Save filters"
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
