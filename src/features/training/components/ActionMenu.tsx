import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { spacing, usePalette } from '@/theme/tokens';
import { Button, ui } from './ui';

type Action = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'positive' | 'danger';
};

export function ActionMenu({
  title,
  actions,
  onClose,
}: Readonly<{
  title: string;
  actions: Action[];
  onClose: () => void;
}>) {
  const p = usePalette();
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing['space-6'],
          backgroundColor: p.scrim,
        }}
      >
        <Pressable
          accessibilityLabel="Close actions"
          accessibilityRole="button"
          onPress={onClose}
          style={{ position: 'absolute', inset: 0 }}
        />
        <View
          accessibilityViewIsModal
          style={[ui.card, { width: '100%', maxWidth: 420, backgroundColor: p['surface-200'] }]}
        >
          <Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>
            {title}
          </Text>
          {actions.map((action) => (
            <Button
              key={action.title}
              {...action}
              secondary
              onPress={() => {
                onClose();
                action.onPress();
              }}
            />
          ))}
          <Button title="Cancel" secondary onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
