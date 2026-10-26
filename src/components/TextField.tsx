import React, { useState, type ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { radii, sizes, spacing, textStyles, usePalette, palette } from '@/theme/tokens';

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  leading?: ReactNode;
  trailing?: ReactNode;
  invalid?: boolean;
  theme?: 'system' | 'light' | 'dark';
};

export function TextField({
  containerStyle,
  inputStyle,
  leading,
  trailing,
  invalid = false,
  theme = 'system',
  editable,
  onFocus,
  onBlur,
  placeholderTextColor,
  selectionColor,
  underlineColorAndroid,
  ...input
}: TextFieldProps) {
  const systemPalette = usePalette();
  const p = theme === 'system' ? systemPalette : palette(theme);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isFocused = focused && editable !== false;
  const isHighlighted = (isFocused || hovered) && editable !== false;

  return (
    <View
      onPointerEnter={(event) => {
        if (event.nativeEvent.pointerType === 'mouse') setHovered(true);
      }}
      onPointerLeave={(event) => {
        if (event.nativeEvent.pointerType === 'mouse') setHovered(false);
      }}
      style={[
        styles.container,
        {
          backgroundColor: p['surface-300'],
          borderColor: getBorderColor(invalid, isHighlighted, p),
        },
        editable === false && styles.disabled,
        containerStyle,
      ]}
    >
      {leading}
      <TextInput
        {...input}
        editable={editable}
        placeholderTextColor={placeholderTextColor ?? p['ink-muted']}
        selectionColor={selectionColor ?? p.brand}
        underlineColorAndroid={underlineColorAndroid ?? 'transparent'}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          inputStyle,
          {
            color: p.ink,
            backgroundColor: 'transparent',
            borderWidth: 0,
            borderColor: 'transparent',
            borderRadius: 0,
            outlineColor: 'transparent',
            outlineWidth: 0,
            ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : {}),
          },
        ]}
      />
      {trailing}
    </View>
  );
}

function getBorderColor(
  invalid: boolean | undefined,
  isHighlighted: boolean,
  palette: ReturnType<typeof usePalette>,
) {
  if (invalid) return palette.danger;
  return isHighlighted ? palette.focus : palette['line-strong'];
}

const styles = StyleSheet.create({
  container: {
    minHeight: sizes['control-height'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-2'],
    borderWidth: 1,
    borderRadius: radii['radius-md'],
    paddingHorizontal: spacing['space-3'],
  },
  disabled: { opacity: 0.6 },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: sizes['control-height'] - 4,
    paddingVertical: spacing['space-2'],
    ...textStyles.body,
  },
});
