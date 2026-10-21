import { StyleSheet } from 'react-native';

import { colors } from '@/theme/colors';

export const authStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 30,
    paddingBottom: 25,
  },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  heading: { marginBottom: 8 },
  title: { color: colors.textHeading, fontSize: 25, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: colors.textSecondary, fontSize: 14 },
  body: { color: colors.textLabel, fontSize: 14, lineHeight: 21 },
  label: {
    color: colors.textLabel,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 9,
    marginTop: 16,
  },
  primaryAction: { marginTop: 25 },
  secondaryAction: { marginTop: 12 },
  link: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 27, gap: 12 },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: 10, letterSpacing: 1 },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialButton: { flex: 1 },
  footer: { alignItems: 'center', marginTop: 32 },
  footerText: { color: colors.textSecondary, fontSize: 12 },
  terms: {
    color: colors.textSubtle,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 24,
  },
  status: { marginTop: 16 },
  error: { color: colors.error, fontSize: 13, marginTop: 16 },
});
