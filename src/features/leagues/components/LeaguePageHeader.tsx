import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { LeagueAvatar } from './LeagueAvatar';
import { LeagueIconButton, leagueStyles } from './LeagueUI';

export function LeaguePageHeader({
  accountId,
  title,
  picture,
  member = false,
  subtitle,
  backLabel,
  onBack,
  onOpen,
  action,
  disabled,
}: Readonly<{
  accountId: number;
  title: string;
  picture?: string | null;
  member?: boolean;
  subtitle?: string;
  backLabel: string;
  onBack: () => void;
  onOpen?: () => void;
  action?: React.ReactNode;
  disabled?: boolean;
}>) {
  const p = usePalette();
  const identity = (
    <>
      <LeagueAvatar accountId={accountId} name={title} path={picture} member={member} size={44} />
      <View style={{ flex: 1, minWidth: 0, gap: spacing['space-1'] }}>
        <Text
          accessibilityRole="header"
          numberOfLines={onOpen ? 2 : undefined}
          style={[textStyles['title-lg'], { color: p.ink }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{subtitle}</Text>
        ) : null}
      </View>
      {onOpen ? <Ionicons name="chevron-forward" size={18} color={p['ink-muted']} /> : null}
    </>
  );
  const identityStyle = [leagueStyles.row, { flex: 1, minWidth: 0, minHeight: sizes['tap-min'] }];
  return (
    <View style={leagueStyles.row}>
      <LeagueIconButton label={backLabel} icon="arrow-back" onPress={onBack} disabled={disabled} />
      {onOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View league information for ${title}`}
          disabled={disabled}
          onPress={onOpen}
          style={({ pressed }) => [...identityStyle, { opacity: pressed ? 0.65 : 1 }]}
        >
          {identity}
        </Pressable>
      ) : (
        <View style={identityStyle}>{identity}</View>
      )}
      {action}
    </View>
  );
}
