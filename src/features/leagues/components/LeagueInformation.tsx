import { getTranslation } from '@/i18n/catalog';
import { useLanguage } from '@/i18n/Language';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AnimatedTextSelector } from '@/components/AnimatedTextSelector';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import type { LeagueDetail } from '../schemas';
import { LeagueAvatar } from './LeagueAvatar';
import { LeagueMemberRoleDialog } from './LeagueMemberRoleDialog';
import { LeagueCard, leagueStyles } from './LeagueUI';
import { LeagueRules } from './LeagueRules';

type Member = LeagueDetail['members'][number];

function memberCountLabel(count: number, language: 'en' | 'es') {
  return getTranslation(language)('socialAdditional.membersCount', { count });
}

function memberRoleControlLabel(
  roleLocked: boolean,
  name: string,
  label: string,
  language: 'en' | 'es',
) {
  if (roleLocked) return getTranslation(language)('leagues.role', { name, label });
  return getTranslation(language)('leagues.changeRoleFor', { name });
}

function memberRoleHint(roleLocked: boolean, label: string, language: 'en' | 'es') {
  if (roleLocked) return getTranslation(language)('leagues.roleIsProtected');
  return getTranslation(language)('leagues.currentRole', { label });
}

export function LeagueInformation({
  accountId,
  league,
  children,
  inviteAction,
  onRoleChange,
  onOpenScoreHistory,
}: React.PropsWithChildren<{
  accountId: number;
  league: LeagueDetail;
  inviteAction?: React.ReactNode;
  onRoleChange?: (memberId: number, role: 'admin' | 'member') => Promise<void>;
  onOpenScoreHistory: (member: Member) => void;
}>) {
  const language = useLanguage();

  const p = usePalette();
  const [tab, setTab] = useState<'about' | 'rules'>('about');
  const [target, setTarget] = useState<Member | null>(null);
  const tabs = (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={getTranslation(language)('socialAdditional.leagueInformation_368170')}
      style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: p.line }}
    >
      <AnimatedTextSelector
        role="tab"
        label={getTranslation(language)('socialAdditional.about_b4dfbf')}
        selected={tab === 'about'}
        reduceMotion
        equalWidth
        onPress={() => setTab('about')}
      />
      <AnimatedTextSelector
        role="tab"
        label={getTranslation(language)('socialAdditional.leagueRules_ec816d')}
        selected={tab === 'rules'}
        reduceMotion
        equalWidth
        onPress={() => setTab('rules')}
      />
    </View>
  );

  if (tab === 'rules')
    return (
      <>
        {tabs}
        <LeagueRules timezone={league.timezone} />
      </>
    );

  const nextRole = target?.role === 'admin' ? 'member' : 'admin';
  const memberCount = league.members.length;
  const created = new Date(league.created_at).toLocaleDateString(language, {
    dateStyle: 'medium',
    ...(league.timezone ? { timeZone: league.timezone } : {}),
  });

  const showRoleControl = league.role === 'admin' && Boolean(onRoleChange);
  return (
    <>
      {tabs}
      <LeagueCard>
        <View style={[leagueStyles.row, { justifyContent: 'space-between' }]}>
          <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
            {getTranslation(language)('socialAdditional.about_b4dfbf')}
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
              label: getTranslation(language)('socialAdditional.membership_e12f51'),
              value: memberCountLabel(memberCount, language),
            },
            {
              icon: 'calendar-outline' as const,
              label: getTranslation(language)('socialAdditional.created_915309'),
              value: created,
            },
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
            {getTranslation(language)('socialAdditional.timezone_61191c')}:{' '}
            {league.timezone ?? getTranslation(language)('socialAdditional.notConfigured_984e5e')}
          </Text>
        </View>
        {children}
      </LeagueCard>
      <LeagueCard>
        <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
          {getTranslation(language)('socialAdditional.members_6fc6dd')}
        </Text>
        <View>
          {league.members.map((member, index) => {
            const name =
              member.display_name ?? getTranslation(language)('socialAdditional.member_10100e');
            const creator = member.user_id === league.creator_id;
            const admin = creator || member.role === 'admin';
            const own = member.user_id === accountId;
            const roleLocked = creator || own;
            const label = admin
              ? getTranslation(language)('socialAdditional.admin_4257ee')
              : getTranslation(language)('socialAdditional.member_10100e');
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
                borderRadius: radii['radius-md'],
                backgroundColor:
                  admin && !(showRoleControl && roleLocked) ? p['brand-soft'] : p['surface-300'],
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={getTranslation(language)('leagues.viewScoreHistoryFor', {
                    name,
                  })}
                  onPress={() => onOpenScoreHistory(member)}
                  style={({ pressed }) => [
                    leagueStyles.row,
                    {
                      flex: 1,
                      minWidth: 0,
                      minHeight: sizes['tap-min'],
                      opacity: pressed ? 0.65 : 1,
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
                      {own ? getTranslation(language)('socialAdditional.you_1e2cca') : ''}
                    </Text>
                    {creator ? (
                      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                        {getTranslation(language)('socialAdditional.creator_ab1482')}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
                {showRoleControl ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={memberRoleControlLabel(roleLocked, name, label, language)}
                    accessibilityState={{ disabled: roleLocked }}
                    disabled={roleLocked}
                    accessibilityHint={memberRoleHint(roleLocked, label, language)}
                    onPress={() => setTarget(member)}
                    style={({ pressed }) => [
                      ...badge,
                      {
                        minHeight: sizes['tap-min'],
                        borderWidth: 1,
                        borderColor: roleLocked ? p.line : p['line-strong'],
                        opacity: pressed ? 0.65 : 1,
                      },
                    ]}
                  >
                    {role}
                    <Ionicons
                      name={roleLocked ? 'lock-closed-outline' : 'chevron-down'}
                      size={14}
                      color={p['ink-muted']}
                    />
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
          name={
            target.display_name ?? getTranslation(language)('socialAdditional.thisMember_d15f89')
          }
          nextRole={nextRole}
          onConfirm={() => onRoleChange(target.user_id, nextRole)}
          onCancel={() => setTarget(null)}
        />
      ) : null}
    </>
  );
}
