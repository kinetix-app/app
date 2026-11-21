import { createContext, useContext } from 'react';
import type { TextStyle } from 'react-native';
import source from './design-tokens.json';
import lightPalette from './light-palette.json';

export function palette(theme: 'light' | 'dark' = 'dark'): Record<string, string> {
  const dark = Object.fromEntries(source.color.tokens.map((token) => [token.name, token.value]));
  const values = theme === 'light' ? { ...dark, ...lightPalette } : dark;
  values.focus = values.brand;
  return values;
}
export const spacing = Object.fromEntries(
  source.spacing.tokens.map((t) => [t.name, Number.parseInt(t.value, 10)]),
);
export const radii = Object.fromEntries(
  source.radius.tokens.map((t) => [t.name, Number.parseInt(t.value, 10)]),
);
export const sizes = Object.fromEntries(
  source.size.tokens.map((t) => [t.name, Number.parseInt(t.value, 10)]),
);
export const typography = source.type.groups.flatMap((group) => group.styles);
export const textStyles: Record<string, TextStyle> = Object.fromEntries(
  typography.map((token) => {
    const fontSize = Number.parseFloat(token.fontSize);
    return [
      token.name,
      {
        fontSize,
        lineHeight: Number.parseFloat(token.lineHeight),
        fontWeight: String(token.fontWeight) as TextStyle['fontWeight'],
        ...(typeof token.letterSpacing === 'string'
          ? { letterSpacing: Number.parseFloat(token.letterSpacing) * fontSize }
          : {}),
      },
    ];
  }),
);
export const shadows = () =>
  Object.fromEntries(source.shadow.tokens.map((token) => [token.name, token.value]));
const PaletteContext = createContext(palette());
export const PaletteProvider = PaletteContext.Provider;
export function usePalette() {
  return useContext(PaletteContext);
}
