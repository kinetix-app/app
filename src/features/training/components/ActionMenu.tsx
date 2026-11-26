import React from 'react';
import { useLanguage } from '@/i18n/Language';
import { Modal, Pressable, Text, View } from 'react-native';
import { spacing, usePalette } from '@/theme/tokens';
import { Button, ui } from './ui';

type Action = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'positive' | 'danger';
};

const COPY = {
  en: { close: 'Close actions', cancel: 'Cancel' },
  es: { close: 'Cerrar acciones', cancel: 'Cancelar' },
} as const;

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
  const language = useLanguage();
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
          accessibilityLabel={COPY[language].close}
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
          <Button title={COPY[language].cancel} secondary onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
