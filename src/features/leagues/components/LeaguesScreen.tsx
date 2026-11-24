import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, screenContentStyle } from '@/components/ScreenHeader';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { TextField } from '@/components/TextField';
import { ApiError } from '@/services/apiClient';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { leaguesApi } from '../api';
import {
  createSchema,
  descriptionLimit,
  invitationToken,
  nameSchema,
  type ScoreHistoryMember,
} from '../schemas';
import { LeagueAction, LeagueCard, LeagueIconButton, leagueStyles } from './LeagueUI';
import { LeagueAvatar } from './LeagueAvatar';
import { LeagueDialog } from './LeagueDialog';
import { LeagueInvitationCard } from './LeagueInvitationCard';
import { LeagueShareInvitation } from './LeagueShareInvitation';
import { LeagueInformation } from './LeagueInformation';
import { LeaguePageHeader } from './LeaguePageHeader';
import { LeagueTimezonePicker } from './LeagueTimezonePicker';
import { leagueConfigurationForm } from './leaguePicture';
import { LeaguePictureEditor, type LeaguePictureDraft } from './LeaguePictureEditor';
import { LeagueResults } from './LeagueResults';
import { LeagueScoreHistory } from './LeagueScoreHistory';
import { LeagueStandings } from './LeagueStandings';

function message(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 410) return 'This invitation has expired.';
    if (error.status === 404) return 'League or invitation not found.';
    if (error.status === 403) return 'Only a league admin can do that.';
  }
  return 'Something went wrong. Please try again.';
}

function handlesLeagueBack(
  active: boolean,
  detailOpen: boolean,
  information: boolean,
  hasData: boolean,
  isError: boolean,
) {
  return active && detailOpen && (information || !hasData || isError);
}

export function LeaguesScreen({
  accountId,
  initialInvitation,
  active = true,
  onDetailOpenChange,
}: Readonly<{
  accountId: number;
  initialInvitation?: string;
  active?: boolean;
  onDetailOpenChange?: (open: boolean) => void;
}>) {
  const p = usePalette();
  const cache = useQueryClient();
  const key = ['leagues', accountId];
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [joinOpen, setJoinOpen] = useState(false);
  const [information, setInformation] = useState(false);
  const [historyMember, setHistoryMember] = useState<ScoreHistoryMember | null>(null);
  const [editing, setEditing] = useState(false);
  const [picture, setPicture] = useState<LeaguePictureDraft>();
  const detailOpen = selected !== null;
  useEffect(() => {
    onDetailOpenChange?.(detailOpen);
  }, [detailOpen, onDetailOpenChange]);
  const [pictureBusy, setPictureBusy] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState<string | null>(null);
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  );
  const [input, setInput] = useState('');
  const [token, setToken] = useState(initialInvitation ?? '');
  const [error, setError] = useState('');
  const [invite, setInvite] = useState('');
  const list = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => leaguesApi.list(signal),
    enabled: active,
  });
  const detail = useQuery({
    queryKey: [...key, selected],
    queryFn: ({ signal }) => leaguesApi.detail(selected!, signal),
    enabled: selected !== null,
  });
  const refresh = () => {
    void cache.invalidateQueries({ queryKey: key });
  };
  const create = useMutation({
    mutationFn: () =>
      leaguesApi.createConfiguration(
        leagueConfigurationForm(
          {
            name,
            timezone,
            description: description?.trim() || null,
          },
          picture ?? undefined,
        ),
      ),
    onSuccess: (league) => {
      refresh();
      setInformation(false);
      setSelected(league.id);
      setMode('list');
      setName('');
      setDescription(null);
      setPicture(undefined);
      setError('');
    },
    onError: (e) => setError(message(e)),
  });
  const save = useMutation({
    mutationFn: (leagueId: number) =>
      leaguesApi.saveConfiguration(
        leagueId,
        leagueConfigurationForm(
          {
            name,
            description: description?.trim() || null,
            remove_picture: picture === null,
          },
          picture ?? undefined,
        ),
      ),
    onSuccess: (league) => {
      cache.setQueryData([...key, league.id], league);
      refresh();
      setEditing(false);
      setPicture(undefined);
      setError('');
    },
    onError: (e) => setError(message(e)),
  });
  const generate = useMutation({
    mutationFn: () => leaguesApi.invite(selected!),
    onSuccess: (result) => {
      setInvite(Linking.createURL(`league-invitation/${encodeURIComponent(result.token)}`));
      setError('');
    },
    onError: (e) => setError(message(e)),
  });
  const preview = useQuery({
    queryKey: [...key, 'invitation', token],
    queryFn: ({ signal }) => leaguesApi.preview(token, signal),
    enabled: active && Boolean(token),
    retry: false,
    gcTime: 0,
  });
  function openInvitedLeague(id: number) {
    refresh();
    setInformation(false);
    setSelected(id);
    setMode('list');
    setInput('');
    setToken('');
    setError('');
  }
  const accept = useMutation({
    mutationFn: () => leaguesApi.accept(token),
    onSuccess: (league) => openInvitedLeague(league.id),
    onError: (e) => setError(message(e)),
  });
  const pending =
    create.isPending || save.isPending || generate.isPending || accept.isPending || pictureBusy;
  const button = (
    label: string,
    onPress: () => void,
    disabled = false,
    variant: 'primary' | 'positive' | 'neutral' = 'neutral',
  ) => <LeagueAction label={label} onPress={onPress} disabled={disabled} variant={variant} />;
  const field = (label: string, value: string, change: (value: string) => void) => (
    <View style={{ gap: spacing['space-2'] }}>
      <Text style={[textStyles.label, { color: p.ink }]}>{label}</Text>
      <TextField
        accessibilityLabel={label}
        value={value}
        onChangeText={change}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!pending}
      />
    </View>
  );
  const descriptionField = (value: string) => (
    <View style={{ gap: spacing['space-2'] }}>
      <Text style={[textStyles.label, { color: p.ink }]}>League description</Text>
      <TextField
        accessibilityLabel="League description"
        value={value}
        onChangeText={setDescription}
        multiline
        maxLength={descriptionLimit}
        editable={!pending}
        placeholder="What is your league about?"
        inputStyle={{ minHeight: 88, textAlignVertical: 'top' }}
      />
    </View>
  );
  function back() {
    if (historyMember) {
      setHistoryMember(null);
      return;
    }
    if (pending) return;
    setPicture(undefined);
    setDescription(null);
    setError('');
    if (editing) {
      setEditing(false);
      return;
    }
    if (information) {
      setInformation(false);
      setName('');
      setError('');
      setInvite('');
      return;
    }
    refresh();
    setSelected(null);
    setMode('list');
    setName('');
    setError('');
    setInvite('');
    setToken('');
  }
  useHardwareBack(
    () => {
      back();
      return true;
    },
    handlesLeagueBack(active, detailOpen, information, Boolean(detail.data), detail.isError),
  );
  const leagueTitle =
    detail.data?.name ?? list.data?.find((item) => item.id === selected)?.name ?? 'League';
  const beginEdit = () => {
    if (detail.data?.role !== 'admin') return;
    setName(detail.data.name);
    setDescription(detail.data.description ?? '');
    setPicture(undefined);
    setError('');
    setEditing(true);
  };
  function openInformation() {
    setInformation(true);
    if (detail.isStale) void detail.refetch();
  }

  function renderHeader() {
    const informationSubtitle = information ? 'League information' : undefined;
    const informationBackLabel = information ? 'Back to league' : 'Back to leagues';
    let navigationLabel = information ? 'Standings' : 'Leagues';
    if (editing) navigationLabel = 'Cancel';
    if (selected !== null)
      return (
        <LeaguePageHeader
          accountId={accountId}
          title={leagueTitle}
          picture={detail.data?.picture_url}
          subtitle={editing ? 'Edit league' : informationSubtitle}
          backLabel={editing ? 'Cancel editing' : informationBackLabel}
          onBack={back}
          disabled={pending}
          onOpen={!information && detail.data ? openInformation : undefined}
          navigationLabel={navigationLabel}
          onEdit={information && !editing && detail.data?.role === 'admin' ? beginEdit : undefined}
        />
      );
    return renderListHeader();
  }

  function renderListHeader() {
    return (
      <ScreenHeader
        title={mode === 'create' ? 'Create league' : 'FriendsLeague'}
        leading={
          mode !== 'list' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to leagues"
              onPress={back}
              disabled={pending}
              accessibilityState={{ disabled: pending }}
              style={{
                minWidth: sizes['tap-min'],
                minHeight: sizes['tap-min'],
                borderRadius: radii['radius-pill'],
                backgroundColor: p['surface-300'],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="arrow-back" size={24} color={p.ink} />
            </Pressable>
          ) : undefined
        }
      />
    );
  }

  function renderLeagueList() {
    if (list.isPending) return <ActivityIndicator accessibilityLabel="Loading leagues" />;
    if (list.isError)
      return (
        <>
          {button('Retry', () => {
            void list.refetch();
          })}
          <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
            Could not load leagues.
          </Text>
        </>
      );
    if (list.data?.length)
      return (
        <View style={leagueStyles.section}>
          {list.data.map((league) => {
            const position = league.current_week_position;
            const rankHint =
              position === null
                ? 'Weekly rank unavailable'
                : `Your position this week is ${position}`;
            const memberLabel = league.member_count === 1 ? 'member' : 'members';
            return (
              <Pressable
                key={league.id}
                accessibilityRole="button"
                accessibilityLabel={league.name}
                accessibilityHint={`${rankHint}, ${league.member_count} ${memberLabel}. Opens league standings.`}
                onPress={() => {
                  setInformation(false);
                  setSelected(league.id);
                  setError('');
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              >
                <LeagueCard>
                  <View style={leagueStyles.row}>
                    <LeagueAvatar
                      accountId={accountId}
                      path={league.picture_url}
                      name={league.name}
                      size={52}
                    />
                    <View style={{ flex: 1, minWidth: 0, gap: spacing['space-1'] }}>
                      <Text style={[textStyles['title-md'], { color: p.ink }]}>{league.name}</Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          columnGap: spacing['space-3'],
                          rowGap: spacing['space-1'],
                        }}
                      >
                        <Text
                          style={[
                            textStyles['body-sm'],
                            {
                              color:
                                league.current_week_position === null
                                  ? p['ink-muted']
                                  : p['brand-ink'],
                              fontVariant: ['tabular-nums'],
                            },
                          ]}
                        >
                          {league.current_week_position === null
                            ? 'Weekly rank unavailable'
                            : `#${league.current_week_position} this week`}
                        </Text>
                        <Text
                          style={[
                            textStyles['body-sm'],
                            { color: p['ink-muted'], fontVariant: ['tabular-nums'] },
                          ]}
                        >
                          {league.member_count} {league.member_count === 1 ? 'member' : 'members'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={p['ink-muted']} />
                  </View>
                </LeagueCard>
              </Pressable>
            );
          })}
        </View>
      );
    return (
      <LeagueCard>
        <Ionicons name="people-outline" size={40} color={p['brand-ink']} />
        <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
          You have no leagues yet.
        </Text>
        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
          Create a league for your friends or join one with an invitation link.
        </Text>
      </LeagueCard>
    );
  }

  function renderDetailError() {
    if (!error) return null;
    return (
      <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
        {error}
      </Text>
    );
  }

  function renderLeagueDetails() {
    if (detail.isPending) return <ActivityIndicator accessibilityLabel="Loading league" />;
    if (detail.isError || !detail.data)
      return (
        <>
          {button('Retry', () => {
            void detail.refetch();
          })}
          <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
            Could not load league.
          </Text>
        </>
      );
    const league = detail.data;
    const isAdmin = league.role === 'admin';
    const canEdit = editing && isAdmin;
    return (
      <>
        {canEdit ? (
          <LeagueCard>
            <LeaguePictureEditor
              accountId={accountId}
              name={name}
              path={league.picture_url}
              draft={picture}
              onChange={setPicture}
              onBusy={setPictureBusy}
              disabled={pending}
            />
            {field('League name', name, setName)}
            {descriptionField(description ?? '')}
            {renderDetailError()}
            {button(
              save.isPending ? 'Saving…' : 'Save',
              () => {
                const result = nameSchema.safeParse(name);
                if (!result.success) {
                  setError(result.error.issues[0].message);
                  return;
                }
                if (selected !== null) save.mutate(selected);
              },
              pending,
              'primary',
            )}
          </LeagueCard>
        ) : (
          <LeagueInformation
            accountId={accountId}
            league={league}
            onOpenScoreHistory={setHistoryMember}
            onRoleChange={
              isAdmin
                ? async (memberId, role) => {
                    const updated = await leaguesApi.changeRole(league.id, memberId, role);
                    cache.setQueryData([...key, updated.id], updated);
                    void cache.invalidateQueries({ queryKey: [...key, updated.id] });
                  }
                : undefined
            }
            inviteAction={
              isAdmin ? (
                <LeagueIconButton
                  label="Generate invitation"
                  icon="link-outline"
                  disabled={pending}
                  onPress={() => generate.mutate()}
                />
              ) : undefined
            }
          >
            {renderDetailError()}
          </LeagueInformation>
        )}
      </>
    );
  }

  function renderContent() {
    if (selected !== null) return <>{renderLeagueDetails()}</>;
    if (mode === 'create')
      return (
        <LeagueCard>
          <LeaguePictureEditor
            accountId={accountId}
            name={name}
            draft={picture}
            onChange={setPicture}
            onBusy={setPictureBusy}
            disabled={pending}
          />
          {field('League name', name, setName)}
          {descriptionField(description ?? '')}
          <LeagueTimezonePicker value={timezone} onChange={setTimezone} disabled={pending} />
          {error ? (
            <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
              {error}
            </Text>
          ) : null}
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            The timezone cannot be changed after creation.
          </Text>
          {button(
            create.isPending ? 'Creating…' : 'Create league',
            () => {
              const result = createSchema.safeParse({
                name,
                timezone,
                description: description?.trim() || null,
              });
              if (!result.success) {
                setError(result.error.issues[0].message);
                return;
              }
              create.mutate();
            },
            pending,
            'primary',
          )}
        </LeagueCard>
      );
    return (
      <>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-3'] }}>
          <View style={{ flexGrow: 1, flexBasis: 148 }}>
            <LeagueAction
              label="Create league"
              icon="add"
              variant="primary"
              onPress={() => {
                setMode('create');
                setError('');
              }}
            />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 148 }}>
            <LeagueAction
              label="Join a league"
              icon="link-outline"
              onPress={() => {
                setJoinOpen(true);
                setError('');
              }}
            />
          </View>
        </View>
        <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
          Your leagues
        </Text>
        {renderLeagueList()}
      </>
    );
  }

  function renderDialogs() {
    return (
      <>
        {active && joinOpen && !token ? (
          <LeagueDialog
            title="Join a league"
            onClose={() => {
              setJoinOpen(false);
              setError('');
            }}
          >
            {field('Invitation link or token', input, (value) => {
              setInput(value);
              setError('');
            })}
            {error ? (
              <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
                {error}
              </Text>
            ) : null}
            <LeagueAction
              label="Preview invitation"
              variant="primary"
              onPress={() => {
                const value = invitationToken(input);
                if (!value) {
                  setError('Enter an invitation link or token.');
                  return;
                }
                setError('');
                setJoinOpen(false);
                setToken(value);
              }}
            />
          </LeagueDialog>
        ) : null}
        {active && invite ? (
          <LeagueShareInvitation link={invite} onClose={() => setInvite('')} />
        ) : null}
        {active && token ? (
          <LeagueInvitationCard
            accountId={accountId}
            token={token}
            invitation={preview.data}
            loading={preview.isFetching && !preview.data}
            joining={accept.isPending}
            error={preview.isError ? message(preview.error) : error || undefined}
            retry={
              preview.isError &&
              (!(preview.error instanceof ApiError) || ![404, 410].includes(preview.error.status))
                ? () => {
                    void preview.refetch();
                  }
                : undefined
            }
            onJoin={() => {
              setError('');
              if (preview.data?.already_member) openInvitedLeague(preview.data.league_id);
              else accept.mutate();
            }}
            onClose={() => {
              setToken('');
              setError('');
            }}
          />
        ) : null}
      </>
    );
  }

  const header = renderHeader();
  const league = selected !== null && !detail.isError ? detail.data : undefined;
  return (
    <SafeAreaView
      edges={detailOpen ? ['top', 'bottom', 'left', 'right'] : ['top']}
      style={{ flex: 1, backgroundColor: p['surface-100'] }}
    >
      {league ? (
        <LeagueResults
          key={`results-${league.id}`}
          accountId={accountId}
          leagueId={league.id}
          active={active}
          timezone={league.timezone}
        />
      ) : null}
      {league && historyMember ? (
        <LeagueScoreHistory
          accountId={accountId}
          leagueId={league.id}
          member={historyMember}
          timezone={league.timezone ?? 'UTC'}
          active={active}
          backTo="League information"
          onBack={back}
        />
      ) : null}
      {league && !historyMember && !information ? (
        <LeagueStandings
          key={league.id}
          accountId={accountId}
          leagueId={league.id}
          active={active}
          header={header}
          onBack={back}
        />
      ) : null}
      {!(league && (historyMember || !information)) ? (
        <>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            accessibilityElementsHidden={active && Boolean(token || invite || joinOpen)}
            importantForAccessibility={
              active && (token || invite || joinOpen) ? 'no-hide-descendants' : 'auto'
            }
            contentContainerStyle={[
              screenContentStyle,
              selected !== null && { paddingTop: spacing['space-3'] },
              { paddingBottom: spacing['space-8'], gap: spacing['space-6'] },
            ]}
          >
            {header}
            {renderContent()}
          </ScrollView>
          {renderDialogs()}
        </>
      ) : null}
    </SafeAreaView>
  );
}
