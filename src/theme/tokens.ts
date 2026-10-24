import { useColorScheme, type TextStyle } from 'react-native';
import source from './design-tokens.json';

type Theme = 'dark' | 'light';
export function palette(theme: Theme): Record<string, string> {
  const values = Object.fromEntries(
    source.color.tokens.map((token) => [
      token.name,
      typeof token.value === 'string' ? token.value : token.value[theme],
    ]),
  );
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
export const shadows = (theme: Theme) =>
  Object.fromEntries(source.shadow.tokens.map((token) => [token.name, token.value[theme]]));
export function usePalette() {
  return palette(useColorScheme() === 'light' ? 'light' : 'dark');
}
