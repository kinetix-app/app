import React from 'react';
import { Text, View } from 'react-native';
import { textStyles, usePalette } from '@/theme/tokens';
import type { LeagueDetail } from '../schemas';
import { LeagueAvatar } from './LeagueAvatar';
import { LeagueCard, leagueStyles } from './LeagueUI';
import { LeagueRules } from './LeagueRules';

export function LeagueInformation({
  accountId,
  league,
  children,
}: React.PropsWithChildren<{ accountId: number; league: LeagueDetail }>) {
  const p = usePalette();
  return (
    <>
      <LeagueCard>
        <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
          League information
        </Text>
        <Text style={[textStyles.body, { color: p.ink }]}>{league.name}</Text>
        <Text style={[textStyles.body, { color: p.ink }]}>
          {league.members.length} {league.members.length === 1 ? 'member' : 'members'}
        </Text>
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          Created{' '}
          {new Date(league.created_at).toLocaleDateString(undefined, {
            dateStyle: 'medium',
            ...(league.timezone ? { timeZone: league.timezone } : {}),
          })}
        </Text>
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          Timezone: {league.timezone ?? 'Not configured for this older league'} · Fixed at creation
        </Text>
        {league.role !== 'admin' ? (
          <View style={{ alignItems: 'center' }}>
            <LeagueAvatar
              accountId={accountId}
              path={league.picture_url}
              name={league.name}
              size={112}
              retryable
            />
          </View>
        ) : null}
      </LeagueCard>
      {children}
      <LeagueRules timezone={league.timezone} />
      <LeagueCard>
        <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
          Members
        </Text>
        {league.members.map((member) => (
          <View key={member.user_id} style={leagueStyles.row}>
            <LeagueAvatar
              accountId={accountId}
              path={member.picture_url}
              name={member.display_name ?? 'Member'}
              member
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[textStyles.body, { color: p.ink }]}>
                {member.display_name ?? 'Member'}
                {member.user_id === accountId ? ' (you)' : ''}
              </Text>
            </View>
            <Text
              style={[
                textStyles.label,
                { color: member.role === 'admin' ? p['brand-ink'] : p['ink-muted'] },
              ]}
            >
              {member.role === 'admin' ? 'Admin' : 'Member'}
            </Text>
          </View>
        ))}
      </LeagueCard>
    </>
  );
}
