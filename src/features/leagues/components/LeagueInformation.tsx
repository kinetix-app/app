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
  let noun: string;
  if (language === 'es') noun = count === 1 ? 'miembro' : 'miembros';
  else noun = count === 1 ? 'member' : 'members';
  return `${count} ${noun}`;
}

function memberRoleControlLabel(
  roleLocked: boolean,
  name: string,
  label: string,
  language: 'en' | 'es',
) {
  if (roleLocked) return language === 'es' ? `Rol de ${name}: ${label}` : `${name} role: ${label}`;
  return language === 'es' ? `Cambiar rol de ${name}` : `Change role for ${name}`;
}

function memberRoleHint(roleLocked: boolean, label: string, language: 'en' | 'es') {
  if (roleLocked) return language === 'es' ? 'El rol está protegido' : 'Role is protected';
  return language === 'es' ? `Rol actual: ${label}` : `Current role: ${label}`;
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
  const t = (en: string, es: string) => (language === 'es' ? es : en);
  const p = usePalette();
  const [tab, setTab] = useState<'about' | 'rules'>('about');
  const [target, setTarget] = useState<Member | null>(null);
  const tabs = (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('League information', 'Información de la liga')}
      style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: p.line }}
    >
      <AnimatedTextSelector
        role="tab"
        label={t('About', 'Acerca de')}
        selected={tab === 'about'}
        reduceMotion
        equalWidth
        onPress={() => setTab('about')}
      />
      <AnimatedTextSelector
        role="tab"
        label={t('League rules', 'Reglas de la liga')}
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
  const created = new Date(league.created_at).toLocaleDateString(
    language === 'es' ? 'es' : undefined,
    {
      dateStyle: 'medium',
      ...(league.timezone ? { timeZone: league.timezone } : {}),
    },
  );

  const showRoleControl = league.role === 'admin' && Boolean(onRoleChange);
  return (
    <>
      {tabs}
      <LeagueCard>
        <View style={[leagueStyles.row, { justifyContent: 'space-between' }]}>
          <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
            {t('About', 'Acerca de')}
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
              label: t('Membership', 'Miembros'),
              value: memberCountLabel(memberCount, language),
            },
            { icon: 'calendar-outline' as const, label: t('Created', 'Creada'), value: created },
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
            {t('Timezone', 'Zona horaria')}:{' '}
            {league.timezone ?? t('Not configured', 'Sin configurar')}
          </Text>
        </View>
        {children}
      </LeagueCard>
      <LeagueCard>
        <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
          {t('Members', 'Miembros')}
        </Text>
        <View>
          {league.members.map((member, index) => {
            const name = member.display_name ?? t('Member', 'Miembro');
            const creator = member.user_id === league.creator_id;
            const admin = creator || member.role === 'admin';
            const own = member.user_id === accountId;
            const roleLocked = creator || own;
            const label = admin ? t('Admin', 'Administrador') : t('Member', 'Miembro');
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
                  accessibilityLabel={
                    language === 'es'
                      ? `Ver historial de puntos de ${name}`
                      : `View score history for ${name}`
                  }
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
                      {own ? t(' (you)', ' (tú)') : ''}
                    </Text>
                    {creator ? (
                      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                        {t('Creator', 'Creador')}
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
          name={target.display_name ?? t('This member', 'Este miembro')}
          nextRole={nextRole}
          onConfirm={() => onRoleChange(target.user_id, nextRole)}
          onCancel={() => setTarget(null)}
        />
      ) : null}
    </>
  );
}
