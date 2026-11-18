import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import type { LeagueDetail } from '../schemas';
import { LeagueAvatar } from './LeagueAvatar';
import { LeagueMemberRoleDialog } from './LeagueMemberRoleDialog';
import { LeagueCard, leagueStyles } from './LeagueUI';
import { LeagueRules } from './LeagueRules';

type Member = LeagueDetail['members'][number];

export function LeagueInformation({
  accountId,
  league,
  children,
  inviteAction,
  onRoleChange,
}: React.PropsWithChildren<{
  accountId: number;
  league: LeagueDetail;
  inviteAction?: React.ReactNode;
  onRoleChange?: (memberId: number, role: 'admin' | 'member') => Promise<void>;
}>) {
  const p = usePalette();
  const [target, setTarget] = useState<Member | null>(null);
  const nextRole = target?.role === 'admin' ? 'member' : 'admin';
  const memberCount = league.members.length;
  const created = new Date(league.created_at).toLocaleDateString(undefined, {
    dateStyle: 'medium',
    ...(league.timezone ? { timeZone: league.timezone } : {}),
  });

  return (
    <>
      <LeagueCard>
        <View style={[leagueStyles.row, { justifyContent: 'space-between' }]}>
          <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
            About
          </Text>
          {inviteAction}
        </View>
        {league.description ? (
          <Text style={[textStyles.body, { color: p['ink-muted'] }]}>{league.description}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-2'] }}>
          {[
            {
              icon: 'people-outline' as const,
              label: 'Membership',
              value: `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`,
            },
            { icon: 'calendar-outline' as const, label: 'Created', value: created },
          ].map(({ icon, label, value }) => (
            <View
              key={label}
              style={{
                flexGrow: 1,
                flexBasis: 115,
                padding: spacing['space-3'],
                gap: spacing['space-1'],
                borderRadius: radii['radius-md'],
                backgroundColor: p['surface-300'],
              }}
            >
              <Ionicons name={icon} size={20} color={p['brand-ink']} />
              <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{label}</Text>
              <Text style={[textStyles.label, { color: p.ink, fontVariant: ['tabular-nums'] }]}>
                {value}
              </Text>
            </View>
          ))}
        </View>
        <View style={leagueStyles.row}>
          <Ionicons name="globe-outline" size={20} color={p['ink-muted']} />
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'], flex: 1 }]}>
            Timezone: {league.timezone ?? 'Not configured'}
          </Text>
        </View>
        {children}
      </LeagueCard>
      <LeagueRules timezone={league.timezone} />
      <LeagueCard>
        <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
          Members
        </Text>
        <View>
          {league.members.map((member, index) => {
            const name = member.display_name ?? 'Member';
            const creator = member.user_id === league.creator_id;
            const admin = creator || member.role === 'admin';
            const own = member.user_id === accountId;
            const canChange = Boolean(onRoleChange && league.role === 'admin' && !creator && !own);
            const label = admin ? 'Admin' : 'Member';
            const role = (
              <Text style={[textStyles.label, { color: admin ? p['brand-ink'] : p.ink }]}>
                {label}
              </Text>
            );
            const badge = [
              leagueStyles.row,
              {
                gap: spacing['space-1'],
                paddingHorizontal: spacing['space-2'],
                paddingVertical: spacing['space-1'],
                borderRadius: radii['radius-pill'],
                backgroundColor: admin ? p['brand-soft'] : p['surface-300'],
              },
            ];
            return (
              <View
                key={member.user_id}
                style={[
                  leagueStyles.row,
                  {
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderColor: p.line,
                    paddingVertical: spacing['space-2'],
                  },
                ]}
              >
                <LeagueAvatar
                  accountId={accountId}
                  path={member.picture_url}
                  name={name}
                  member
                  size={40}
                />
                <View style={{ flex: 1, minWidth: 0, gap: spacing['space-1'] }}>
                  <Text style={[textStyles.body, { color: p.ink }]}>
                    {name}
                    {own ? ' (you)' : ''}
                  </Text>
                  {creator ? (
                    <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>Creator</Text>
                  ) : null}
                </View>
                {canChange ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Change role for ${name}`}
                    accessibilityHint={`Current role: ${label}`}
                    onPress={() => setTarget(member)}
                    style={({ pressed }) => [
                      ...badge,
                      {
                        minHeight: sizes['tap-min'],
                        borderWidth: 1,
                        borderColor: p['line-strong'],
                        opacity: pressed ? 0.65 : 1,
                      },
                    ]}
                  >
                    {role}
                    <Ionicons name="chevron-down" size={14} color={p['ink-muted']} />
                  </Pressable>
                ) : (
                  <View style={badge}>{role}</View>
                )}
              </View>
            );
          })}
        </View>
      </LeagueCard>
      {target && onRoleChange ? (
        <LeagueMemberRoleDialog
          name={target.display_name ?? 'This member'}
          nextRole={nextRole}
          onConfirm={() => onRoleChange(target.user_id, nextRole)}
          onCancel={() => setTarget(null)}
        />
      ) : null}
    </>
  );
}
