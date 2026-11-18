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
import { createSchema, descriptionLimit, invitationToken, nameSchema } from '../schemas';
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
import { LeagueStandings } from './LeagueStandings';

function message(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 410) return 'This invitation has expired.';
    if (error.status === 404) return 'League or invitation not found.';
    if (error.status === 403) return 'Only a league admin can do that.';
  }
  return 'Something went wrong. Please try again.';
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
    active && detailOpen && (information || !detail.data || detail.isError),
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
  const header =
    selected !== null ? (
      <LeaguePageHeader
        accountId={accountId}
        title={leagueTitle}
        picture={detail.data?.picture_url}
        subtitle={editing ? 'Edit league' : information ? 'League information' : undefined}
        backLabel={editing ? 'Cancel editing' : information ? 'Back to league' : 'Back to leagues'}
        onBack={back}
        disabled={pending}
        onOpen={
          !information && detail.data
            ? () => {
                setInformation(true);
                void detail.refetch();
              }
            : undefined
        }
        action={
          information && !editing && detail.data?.role === 'admin' ? (
            <LeagueIconButton
              label="Edit league"
              icon="pencil-outline"
              onPress={beginEdit}
              disabled={pending}
            />
          ) : undefined
        }
      />
    ) : (
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
  if (selected !== null && detail.data && !detail.isError && !information) {
    return (
      <SafeAreaView
        edges={['top', 'bottom', 'left', 'right']}
        style={{ flex: 1, backgroundColor: p['surface-100'] }}
      >
        <LeagueResults
          accountId={accountId}
          leagueId={detail.data.id}
          active={active}
          timezone={detail.data.timezone}
        />
        <LeagueStandings
          key={detail.data.id}
          accountId={accountId}
          leagueId={detail.data.id}
          active={active}
          header={header}
          onBack={back}
        />
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView
      edges={detailOpen ? ['top', 'bottom', 'left', 'right'] : ['top']}
      style={{ flex: 1, backgroundColor: p['surface-100'] }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        accessibilityElementsHidden={active && Boolean(token || invite || joinOpen)}
        importantForAccessibility={
          active && (token || invite || joinOpen) ? 'no-hide-descendants' : 'auto'
        }
        contentContainerStyle={[
          screenContentStyle,
          { paddingBottom: spacing['space-8'], gap: spacing['space-6'] },
        ]}
      >
        {header}
        {selected !== null ? (
          <>
            {detail.isPending ? (
              <ActivityIndicator accessibilityLabel="Loading league" />
            ) : detail.isError || !detail.data ? (
              <>
                {button('Retry', () => {
                  void detail.refetch();
                })}
                <Text
                  accessibilityRole="alert"
                  style={[textStyles['body-sm'], { color: p.danger }]}
                >
                  Could not load league.
                </Text>
              </>
            ) : (
              <>
                <LeagueResults
                  accountId={accountId}
                  leagueId={detail.data.id}
                  active={active}
                  timezone={detail.data.timezone}
                />
                {editing && detail.data.role === 'admin' ? (
                  <LeagueCard>
                    <LeaguePictureEditor
                      accountId={accountId}
                      name={name}
                      path={detail.data.picture_url}
                      draft={picture}
                      onChange={setPicture}
                      onBusy={setPictureBusy}
                      disabled={pending}
                    />
                    {field('League name', name, setName)}
                    {descriptionField(description ?? '')}
                    {error ? (
                      <Text
                        accessibilityRole="alert"
                        style={[textStyles['body-sm'], { color: p.danger }]}
                      >
                        {error}
                      </Text>
                    ) : null}
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
                    league={detail.data}
                    onRoleChange={
                      detail.data.role === 'admin'
                        ? async (memberId, role) => {
                            const updated = await leaguesApi.changeRole(
                              detail.data.id,
                              memberId,
                              role,
                            );
                            cache.setQueryData([...key, updated.id], updated);
                            void cache.invalidateQueries({ queryKey: [...key, updated.id] });
                          }
                        : undefined
                    }
                    inviteAction={
                      detail.data.role === 'admin' ? (
                        <LeagueIconButton
                          label="Generate invitation"
                          icon="link-outline"
                          disabled={pending}
                          onPress={() => generate.mutate()}
                        />
                      ) : undefined
                    }
                  >
                    {error ? (
                      <Text
                        accessibilityRole="alert"
                        style={[textStyles['body-sm'], { color: p.danger }]}
                      >
                        {error}
                      </Text>
                    ) : null}
                  </LeagueInformation>
                )}
              </>
            )}
          </>
        ) : mode === 'create' ? (
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
        ) : (
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
            {list.isPending ? (
              <ActivityIndicator accessibilityLabel="Loading leagues" />
            ) : list.isError ? (
              <>
                {button('Retry', () => {
                  void list.refetch();
                })}
                <Text
                  accessibilityRole="alert"
                  style={[textStyles['body-sm'], { color: p.danger }]}
                >
                  Could not load leagues.
                </Text>
              </>
            ) : list.data?.length ? (
              <View style={leagueStyles.section}>
                {list.data.map((league) => (
                  <Pressable
                    key={league.id}
                    accessibilityRole="button"
                    accessibilityLabel={league.name}
                    accessibilityHint={`${league.current_week_position === null ? 'Weekly rank unavailable' : `Your position this week is ${league.current_week_position}`}, ${league.member_count} ${league.member_count === 1 ? 'member' : 'members'}. Opens league standings.`}
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
                          <Text style={[textStyles['title-md'], { color: p.ink }]}>
                            {league.name}
                          </Text>
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
                              {league.member_count}{' '}
                              {league.member_count === 1 ? 'member' : 'members'}
                            </Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={p['ink-muted']} />
                      </View>
                    </LeagueCard>
                  </Pressable>
                ))}
              </View>
            ) : (
              <LeagueCard>
                <Ionicons name="people-outline" size={40} color={p['brand-ink']} />
                <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
                  You have no leagues yet.
                </Text>
                <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
                  Create a league for your friends or join one with an invitation link.
                </Text>
              </LeagueCard>
            )}
          </>
        )}
      </ScrollView>
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
    </SafeAreaView>
  );
}
