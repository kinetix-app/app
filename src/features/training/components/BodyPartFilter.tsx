import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { Button, Failure, Loading, ui } from './ui';

export function BodyPartFilter({
  selected,
  options,
  pending,
  error,
  retry,
  onApply,
  onClose,
}: Readonly<{
  selected: string[];
  options: string[];
  pending: boolean;
  error: Error | null;
  retry: () => void;
  onApply: (parts: string[]) => void;
  onClose: () => void;
}>) {
  const p = usePalette();
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
          <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
            Body parts
          </Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            Show exercises matching any selected body part.
          </Text>
          <ScrollView
            style={{ flexShrink: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: spacing['space-2'] }}
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
                      checked ? previous.filter((value) => value !== part) : [...previous, part],
                    )
                  }
                  style={[
                    ui.row,
                    {
                      minHeight: sizes['control-height'],
                      padding: spacing['space-3'],
                      borderRadius: radii['radius-md'],
                      backgroundColor: checked ? p['brand-soft'] : p['surface-300'],
                    },
                  ]}
                >
                  <Feather
                    name={checked ? 'check-square' : 'square'}
                    size={24}
                    color={checked ? p['brand-ink'] : p['ink-muted']}
                  />
                  <Text style={[textStyles.label, { color: p.ink, flex: 1 }]}>{part}</Text>
                </Pressable>
              );
            })}
            {!pending && !error && available.length === 0 ? (
              <Text style={{ color: p['ink-muted'] }}>No body parts available.</Text>
            ) : null}
          </ScrollView>
          <Button title="Clear" onPress={() => setDraft([])} secondary />
          <View style={ui.row}>
            <View style={{ flex: 1 }}>
              <Button title="Cancel" onPress={onClose} secondary />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Save"
                accessibilityLabel="Save filters"
                onPress={() => onApply([...draft].sort((a, b) => a.localeCompare(b)))}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
