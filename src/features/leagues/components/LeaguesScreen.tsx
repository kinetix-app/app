import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import * as Linking from 'expo-linking';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/services/apiClient';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { leaguesApi } from '../api';
import { createSchema, invitationToken, nameSchema } from '../schemas';
import { LeagueRules } from './LeagueRules';
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
    accept.isPending;
  const button = (label: string, onPress: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: p.brand,
        padding: spacing['space-3'],
        borderRadius: radii['radius-md'],
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: p['on-brand'], textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
  const field = (label: string, value: string, change: (value: string) => void) => (
    <View>
      <Text style={{ color: p.ink }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={change}
        autoCapitalize="none"
        style={{
          color: p.ink,
          borderColor: p.line,
          borderWidth: 1,
          padding: spacing['space-3'],
          borderRadius: radii['radius-md'],
        }}
      />
    </View>
  );
  function back() {
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
        contentContainerStyle={{ padding: spacing['space-5'], gap: spacing['space-4'] }}
      >
        <Text accessibilityRole="header" style={[textStyles.heading, { color: p.ink }]}>
          FriendsLeague
        </Text>
        {selected !== null ? (
          <>
            {button('Back to leagues', back)}
            {detail.isPending ? (
              <ActivityIndicator accessibilityLabel="Loading league" />
            ) : detail.isError || !detail.data ? (
              <>
                {button('Retry', () => {
                  void detail.refetch();
                })}
                <Text accessibilityRole="alert" style={{ color: p.danger }}>
                  Could not load league.
                </Text>
              </>
            ) : (
              <>
                <Text accessibilityRole="header" style={{ color: p.ink, fontSize: 22 }}>
                  {detail.data.name}
                </Text>
                <Text style={{ color: p['ink-muted'] }}>
                  Timezone: {detail.data.timezone ?? 'Not set'}
                </Text>
                <LeagueResults accountId={accountId} leagueId={detail.data.id} active={active} />
                <LeagueStandings accountId={accountId} leagueId={detail.data.id} />
                <LeagueRules timezone={detail.data.timezone} />
                <Text style={{ color: p.ink }}>Members</Text>
                {detail.data.members.map((member) => (
                  <Text key={member.user_id} style={{ color: p.ink }}>
                    {member.display_name ?? 'Member'} · {member.role ?? 'member'}
                  </Text>
                ))}
                {detail.data.role === 'admin' ? (
                  <>
                    {field('New league name', name, setName)}
                    {button(
                      'Rename league',
                      () => {
                        const result = nameSchema.safeParse(name);
                        if (!result.success) {
                          setError(result.error.issues[0].message);
                          return;
                        }
                        rename.mutate();
                      },
                      pending,
                    )}
                    {button('Generate invitation', () => generate.mutate(), pending)}
                    {invite ? (
                      <>
                        <Text selectable style={{ color: p.ink }}>
                          {invite}
                        </Text>
                        <Text style={{ color: p['ink-muted'] }}>
                          Share this link. It expires after 48 hours. Recipients can paste it in
                          Join a league.
                        </Text>
                        {button('Share invitation', () => {
                          void Share.share({ message: invite });
                        })}
                      </>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
          </>
        ) : mode === 'create' ? (
          <>
            {button('Back to leagues', back)}
            {field('League name', name, setName)}
            {field('IANA timezone', timezone, setTimezone)}
            <Text style={{ color: p['ink-muted'] }}>
              The timezone cannot be changed after creation.
            </Text>
            {button(
              'Create league',
              () => {
                const result = createSchema.safeParse({ name, timezone });
                if (!result.success) {
                  setError(result.error.issues[0].message);
                  return;
                }
                create.mutate();
              },
              pending,
            )}
          </>
        ) : mode === 'join' ? (
          <>
            {button('Back to leagues', back)}
            {field('Invitation link or token', input, (value) => {
              setInput(value);
              setToken('');
              preview.reset();
            })}
            {button(
              'Preview invitation',
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
                <Text style={{ color: p.ink }}>Join {preview.data.name}?</Text>
                <Text style={{ color: p['ink-muted'] }}>
                  Expires {new Date(preview.data.expires_at).toLocaleString()}
                </Text>
                {button('Confirm joining', () => accept.mutate(), pending)}
              </>
            ) : null}
          </>
        ) : (
          <>
            {button('Create league', () => {
              setMode('create');
              setError('');
            })}
            {button('Join a league', () => {
              setMode('join');
              setError('');
            })}
            {list.isPending ? (
              <ActivityIndicator accessibilityLabel="Loading leagues" />
            ) : list.isError ? (
              <>
                {button('Retry', () => {
                  void list.refetch();
                })}
                <Text accessibilityRole="alert" style={{ color: p.danger }}>
                  Could not load leagues.
                </Text>
              </>
            ) : list.data?.length ? (
              list.data.map((league) => (
                <React.Fragment key={league.id}>
                  {button(league.name, () => {
                    setSelected(league.id);
                    setError('');
                  })}
                </React.Fragment>
              ))
            ) : (
              <Text style={{ color: p.ink }}>You have no leagues yet.</Text>
            )}
          </>
        )}
        {error ? (
          <Text accessibilityRole="alert" style={{ color: p.danger }}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
