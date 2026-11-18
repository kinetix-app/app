import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { LeagueAvatar } from './LeagueAvatar';
import { leagueStyles } from './LeagueUI';

export function LeaguePageHeader({
  accountId,
  title,
  picture,
  member = false,
  subtitle,
  backLabel,
  onBack,
  onOpen,
  navigationLabel,
  onEdit,
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
  navigationLabel: string;
  onEdit?: () => void;
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
    </>
  );
  return (
    <View style={{ gap: spacing['space-2'] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        disabled={disabled}
        onPress={onBack}
        style={({ pressed }) => [
          leagueStyles.row,
          {
            alignSelf: 'flex-start',
            minHeight: sizes['tap-min'],
            gap: spacing['space-1'],
            opacity: pressed || disabled ? 0.55 : 1,
          },
        ]}
      >
        <Ionicons name="chevron-back" size={18} color={p['ink-muted']} />
        <Text style={[textStyles.label, { color: p['ink-muted'] }]}>{navigationLabel}</Text>
      </Pressable>
      {onOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View league information for ${title}`}
          disabled={disabled}
          onPress={onOpen}
          style={({ pressed }) => [leagueStyles.row, { opacity: pressed || disabled ? 0.55 : 1 }]}
        >
          {identity}
          <View style={[actionStyle, { backgroundColor: p['surface-300'] }]}>
            <Ionicons name="information-circle-outline" size={17} color={p.ink} />
            <Text style={[textStyles.label, { color: p.ink }]}>Info</Text>
          </View>
        </Pressable>
      ) : (
        <View style={[leagueStyles.row, { minHeight: sizes['tap-min'] }]}>
          {identity}
          {onEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit league"
              disabled={disabled}
              onPress={onEdit}
              style={({ pressed }) => [
                actionStyle,
                { backgroundColor: p['brand-soft'], opacity: pressed || disabled ? 0.55 : 1 },
              ]}
            >
              <Ionicons name="pencil-outline" size={16} color={p['brand-ink']} />
              <Text style={[textStyles.label, { color: p['brand-ink'] }]}>Edit</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const actionStyle = [
  leagueStyles.row,
  {
    minHeight: sizes['tap-min'],
    paddingHorizontal: spacing['space-3'],
    gap: spacing['space-2'],
    borderRadius: radii['radius-md'],
    flexShrink: 0,
  },
];
