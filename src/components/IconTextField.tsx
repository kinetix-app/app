import Ionicons from '@expo/vector-icons/Ionicons';
import React, { type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors } from '@/theme/colors';

type IconTextFieldProps = TextInputProps & {
  icon: ComponentProps<typeof Ionicons>['name'];
  trailing?: ReactNode;
};

export function IconTextField({ icon, trailing, style, editable, ...input }: IconTextFieldProps) {
  return (
    <View style={[styles.container, editable === false && styles.disabled]}>
      <Ionicons name={icon} size={20} color={colors.icon} />
      <TextInput
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        editable={editable}
        style={[styles.input, style]}
        {...input}
      />
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 15,
  },
  disabled: { opacity: 0.6 },
  input: { flex: 1, minHeight: 53, color: colors.textPrimary, fontSize: 14 },
});
