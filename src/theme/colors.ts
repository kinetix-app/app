// Compatibility names for existing sign-in components, derived from the design system.
import { palette } from './tokens';
const dark = palette('dark');
export const colors = {
  background: dark['surface-100'],
  surface: dark['surface-200'],
  surfaceMuted: dark['surface-300'],
  border: dark['line-strong'],
  accent: dark.brand,
  onAccent: dark['on-brand'],
  textPrimary: dark.ink,
  textHeading: dark.ink,
  textLabel: dark.ink,
  textSecondary: dark['ink-muted'],
  textMuted: dark['ink-muted'],
  textSubtle: dark['ink-muted'],
  icon: dark['ink-muted'],
  error: dark.danger,
} as const;
