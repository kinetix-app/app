import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import * as Linking from 'expo-linking';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, screenContentStyle } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { ApiError } from '@/services/apiClient';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { leaguesApi } from '../api';
import { createSchema, invitationToken, nameSchema } from '../schemas';
import { LeagueAction, LeagueCard, leagueStyles } from './LeagueUI';
import { LeagueAvatar } from './LeagueAvatar';
import { LeagueInformation } from './LeagueInformation';
import { LeaguePictureEditor } from './LeaguePictureEditor';
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
}: Readonly<{ accountId: number; initialInvitation?: string; active?: boolean }>) {
  const p = usePalette();
  const cache = useQueryClient();
  const key = ['leagues', accountId];
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'join'>(initialInvitation ? 'join' : 'list');
  const [information, setInformation] = useState(false);
  const [pictureBusy, setPictureBusy] = useState(false);
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  );
  const [input, setInput] = useState(initialInvitation ?? '');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [invite, setInvite] = useState('');
  const list = useQuery({ queryKey: key, queryFn: ({ signal }) => leaguesApi.list(signal) });
  const detail = useQuery({
    queryKey: [...key, selected],
    queryFn: ({ signal }) => leaguesApi.detail(selected!, signal),
    enabled: selected !== null,
  });
  const refresh = () => {
    void cache.invalidateQueries({ queryKey: key });
  };
  const create = useMutation({
    mutationFn: () => leaguesApi.create(name, timezone),
    onSuccess: (league) => {
      refresh();
      setInformation(false);
      setSelected(league.id);
      setMode('list');
      setName('');
      setError('');
    },
    onError: (e) => setError(message(e)),
  });
  const rename = useMutation({
    mutationFn: () => leaguesApi.rename(selected!, name),
    onSuccess: () => {
      refresh();
      setName('');
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
  const preview = useMutation({
    mutationFn: (value: string) => leaguesApi.preview(value),
    onSuccess: (_, value) => {
      setToken(value);
      setError('');
    },
    onError: (e) => setError(message(e)),
  });
  const accept = useMutation({
    mutationFn: () => leaguesApi.accept(token),
    onSuccess: (league) => {
      refresh();
      setInformation(false);
      setSelected(league.id);
      setMode('list');
      setInput('');
      setToken('');
      preview.reset();
      setError('');
    },
    onError: (e) => setError(message(e)),
  });
  const pending =
    create.isPending ||
    rename.isPending ||
    generate.isPending ||
    preview.isPending ||
    accept.isPending ||
    pictureBusy;
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
  function back() {
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
    preview.reset();
  }
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p['surface-100'] }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          screenContentStyle,
          { paddingBottom: spacing['space-8'], gap: spacing['space-6'] },
        ]}
      >
        {selected !== null ? (
          <View style={[leagueStyles.row, { alignItems: 'flex-start' }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={information ? 'Back to league' : 'Back to leagues'}
              onPress={back}
              disabled={pending}
              accessibilityState={{ disabled: pending }}
              style={({ pressed }) => ({
                minWidth: sizes['tap-min'],
                minHeight: sizes['tap-min'],
                borderRadius: radii['radius-pill'],
                backgroundColor: p['surface-300'],
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed || pending ? 0.5 : 1,
              })}
            >
              <Ionicons name="arrow-back" size={24} color={p.ink} />
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={leagueStyles.row}>
                <LeagueAvatar
                  accountId={accountId}
                  path={detail.data?.picture_url}
                  name={detail.data?.name ?? 'League'}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View league information for ${detail.data?.name ?? 'league'}`}
                  accessibilityState={{ disabled: pending || information || !detail.data }}
                  disabled={pending || information || !detail.data}
                  onPress={() => setInformation(true)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minWidth: 0,
                    minHeight: sizes['tap-min'],
                    gap: spacing['space-1'],
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text
                    accessibilityRole="header"
                    numberOfLines={2}
                    style={[textStyles['display-lg'], { color: p.ink }]}
                  >
                    {detail.data?.name ??
                      list.data?.find((item) => item.id === selected)?.name ??
                      'Loading league…'}
                  </Text>
                  <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                    {information ? 'League information' : 'View league information'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <ScreenHeader
            title={
              mode === 'create'
                ? 'Create league'
                : mode === 'join'
                  ? 'Join a league'
                  : 'FriendsLeague'
            }
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
        )}
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
                {information ? (
                  <LeagueInformation accountId={accountId} league={detail.data}>
                    {detail.data.role === 'admin' ? (
                      <LeagueCard>
                        <Text
                          accessibilityRole="header"
                          style={[textStyles['title-md'], { color: p.ink }]}
                        >
                          Manage league
                        </Text>
                        <LeaguePictureEditor
                          accountId={accountId}
                          league={detail.data}
                          onBusy={setPictureBusy}
                          disabled={pending && !pictureBusy}
                        />
                        {field('New league name', name, setName)}
                        {error ? (
                          <Text
                            accessibilityRole="alert"
                            style={[textStyles['body-sm'], { color: p.danger }]}
                          >
                            {error}
                          </Text>
                        ) : null}
                        {button(
                          rename.isPending ? 'Saving…' : 'Rename league',
                          () => {
                            const result = nameSchema.safeParse(name);
                            if (!result.success) {
                              setError(result.error.issues[0].message);
                              return;
                            }
                            rename.mutate();
                          },
                          pending,
                          'primary',
                        )}
                        {button(
                          generate.isPending ? 'Generating…' : 'Generate invitation',
                          () => generate.mutate(),
                          pending,
                          'positive',
                        )}
                        {invite ? (
                          <>
                            <Text selectable style={[textStyles['body-sm'], { color: p.ink }]}>
                              {invite}
                            </Text>
                            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                              Share this link. It expires after 48 hours. Recipients can paste it in
                              Join a league.
                            </Text>
                            {button(
                              'Share invitation',
                              () => {
                                void Share.share({ message: invite });
                              },
                              false,
                              'primary',
                            )}
                          </>
                        ) : null}
                      </LeagueCard>
                    ) : null}
                  </LeagueInformation>
                ) : (
                  <LeagueStandings accountId={accountId} leagueId={detail.data.id} />
                )}
              </>
            )}
          </>
        ) : mode === 'create' ? (
          <LeagueCard>
            <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
              Bring your friends together and make every workout count.
            </Text>
            {field('League name', name, setName)}
            {field('IANA timezone', timezone, setTimezone)}
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
                const result = createSchema.safeParse({ name, timezone });
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
        ) : mode === 'join' ? (
          <LeagueCard>
            <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
              Have an invite? Preview the league before joining.
            </Text>
            {field('Invitation link or token', input, (value) => {
              setInput(value);
              setToken('');
              preview.reset();
            })}
            {error ? (
              <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
                {error}
              </Text>
            ) : null}
            {button(
              preview.isPending ? 'Loading…' : 'Preview invitation',
              () => {
                const value = invitationToken(input);
                if (!value) {
                  setError('Enter an invitation link or token.');
                  return;
                }
                preview.mutate(value);
              },
              pending,
            )}
            {token && preview.data ? (
              <>
                <Text style={[textStyles.body, { color: p.ink }]}>Join {preview.data.name}?</Text>
                <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                  Expires {new Date(preview.data.expires_at).toLocaleString()}
                </Text>
                {button(
                  accept.isPending ? 'Joining…' : 'Confirm joining',
                  () => accept.mutate(),
                  pending,
                  'primary',
                )}
              </>
            ) : null}
          </LeagueCard>
        ) : (
          <>
            <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
              Train together. Keep each other going.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-3'] }}>
              <LeagueAction
                label="Create league"
                icon="add"
                variant="positive"
                onPress={() => {
                  setMode('create');
                  setError('');
                }}
              />
              <LeagueAction
                label="Join a league"
                icon="link-outline"
                onPress={() => {
                  setMode('join');
                  setError('');
                }}
              />
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
                          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                            {league.role === 'admin' ? 'Admin' : 'Member'} ·{' '}
                            {league.timezone ?? 'Timezone not set'}
                          </Text>
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
    </SafeAreaView>
  );
}
