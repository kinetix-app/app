import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, shadows, spacing, textStyles, usePalette } from '@/theme/tokens';
import { LeagueIconButton, leagueStyles } from './LeagueUI';

export function LeagueDialog({
  title,
  children,
  onClose,
}: React.PropsWithChildren<{
  title: string;
  onClose: () => void;
}>) {
  const p = usePalette();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: spacing['space-4'] }}>
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          tabIndex={-1}
          onPress={onClose}
          style={{ position: 'absolute', inset: 0, backgroundColor: p.scrim }}
        />
        <View
          accessibilityViewIsModal
          style={{
            alignSelf: 'center',
            width: '100%',
            maxWidth: 440,
            maxHeight: '100%',
            padding: spacing['space-5'],
            gap: spacing['space-4'],
            borderRadius: radii['radius-xl'],
            backgroundColor: p['surface-200'],
            borderWidth: 1,
            borderColor: p.line,
            boxShadow: shadows()['shadow-pop'],
          }}
        >
          <View style={leagueStyles.row}>
            <Text
              accessibilityRole="header"
              style={[textStyles['title-lg'], { flex: 1, color: p.ink }]}
            >
              {title}
            </Text>
            <LeagueIconButton
              label={`Close ${title.toLowerCase()}`}
              icon="close"
              onPress={onClose}
            />
          </View>
          {children}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
