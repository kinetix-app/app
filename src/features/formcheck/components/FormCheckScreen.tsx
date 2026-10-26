import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, textStyles, usePalette } from '@/theme/tokens';
import { IconButton, ui } from '@/features/training/components/ui';

/** Shared frame of every form-check step: back button, titles, scrolling body and actions. */
export function FormCheckScreen({
  overline,
  title,
  onBack,
  backLabel,
  backIcon = 'arrow-left',
  footer,
  scroll = true,
  children,
}: React.PropsWithChildren<{
  overline?: string;
  title?: string;
  onBack: () => void;
  backLabel: string;
  backIcon?: 'arrow-left' | 'x';
  footer?: React.ReactNode;
  scroll?: boolean;
}>) {
  const p = usePalette();
  const body = scroll ? (
    <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[ui.content, { flex: 1 }]}>{children}</View>
  );
  return (
    <SafeAreaView style={[ui.screen, { backgroundColor: p['surface-100'] }]}>
      <View
        style={[ui.row, { paddingHorizontal: spacing['space-4'], paddingTop: spacing['space-2'] }]}
      >
        <IconButton icon={backIcon} label={backLabel} onPress={onBack} />
        <View style={{ flex: 1 }}>
          {overline ? (
            <Text style={[textStyles.overline, { color: p['ink-muted'] }]}>{overline}</Text>
          ) : null}
          {title ? (
            <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
              {title}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={ui.screen}>{body}</View>
      {footer ? (
        <View
          style={{
            width: '100%',
            maxWidth: 640,
            alignSelf: 'center',
            padding: spacing['space-4'],
            gap: spacing['space-2'],
          }}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
