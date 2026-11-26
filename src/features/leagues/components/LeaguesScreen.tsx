import { useLanguage } from '@/i18n/Language';
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

function message(error: unknown, language: 'en' | 'es') {
  if (error instanceof ApiError) {
    if (error.status === 410)
      return language === 'es' ? 'Esta invitación ha caducado.' : 'This invitation has expired.';
    if (error.status === 404)
      return language === 'es'
        ? 'No se encontró la liga o invitación.'
        : 'League or invitation not found.';
    if (error.status === 403)
      return language === 'es'
        ? 'Solo un administrador de la liga puede hacer eso.'
        : 'Only a league admin can do that.';
  }
  return language === 'es'
    ? 'Algo ha salido mal. Inténtalo de nuevo.'
    : 'Something went wrong. Please try again.';
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
  const language = useLanguage();
  const t = (en: string, es: string) => (language === 'es' ? es : en);
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
    onError: (e) => setError(message(e, language)),
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
    onError: (e) => setError(message(e, language)),
  });
  const generate = useMutation({
    mutationFn: () => leaguesApi.invite(selected!),
    onSuccess: (result) => {
      setInvite(Linking.createURL(`league-invitation/${encodeURIComponent(result.token)}`));
      setError('');
    },
    onError: (e) => setError(message(e, language)),
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
    onError: (e) => setError(message(e, language)),
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
      <Text style={[textStyles.label, { color: p.ink }]}>
        {t('League description', 'Descripción de la liga')}
      </Text>
      <TextField
        accessibilityLabel={t('League description', 'Descripción de la liga')}
        value={value}
        onChangeText={setDescription}
        multiline
        maxLength={descriptionLimit}
        editable={!pending}
        placeholder={t('What is your league about?', '¿De qué trata tu liga?')}
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
    detail.data?.name ??
    list.data?.find((item) => item.id === selected)?.name ??
    t('League', 'Liga');
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
    const informationSubtitle = information
      ? t('League information', 'Información de la liga')
      : undefined;
    const informationBackLabel = information
      ? t('Back to league', 'Volver a la liga')
      : t('Back to leagues', 'Volver a ligas');
    let navigationLabel = information ? t('Standings', 'Clasificación') : t('Leagues', 'Ligas');
    if (editing) navigationLabel = t('Cancel', 'Cancelar');
    if (selected !== null)
      return (
        <LeaguePageHeader
          accountId={accountId}
          title={leagueTitle}
          picture={detail.data?.picture_url}
          subtitle={editing ? t('Edit league', 'Editar liga') : informationSubtitle}
          backLabel={editing ? t('Cancel editing', 'Cancelar edición') : informationBackLabel}
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
        title={mode === 'create' ? t('Create league', 'Crear liga') : 'FriendsLeague'}
        leading={
          mode !== 'list' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Back to leagues', 'Volver a ligas')}
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
    if (list.isPending)
      return <ActivityIndicator accessibilityLabel={t('Loading leagues', 'Cargando ligas')} />;
    if (list.isError)
      return (
        <>
          {button(t('Retry', 'Reintentar'), () => {
            void list.refetch();
          })}
          <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
            {t('Could not load leagues.', 'No se pudieron cargar las ligas.')}
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
                ? t('Weekly rank unavailable', 'Clasificación semanal no disponible')
                : language === 'es'
                  ? `Tu posición esta semana es ${position}`
                  : `Your position this week is ${position}`;
            const memberLabel =
              language === 'es'
                ? league.member_count === 1
                  ? 'miembro'
                  : 'miembros'
                : league.member_count === 1
                  ? 'member'
                  : 'members';
            return (
              <Pressable
                key={league.id}
                accessibilityRole="button"
                accessibilityLabel={league.name}
                accessibilityHint={`${rankHint}, ${league.member_count} ${memberLabel}. ${language === 'es' ? 'Abre la clasificación de la liga.' : 'Opens league standings.'}`}
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
                            ? t('Weekly rank unavailable', 'Clasificación semanal no disponible')
                            : language === 'es'
                              ? `#${league.current_week_position} esta semana`
                              : `#${league.current_week_position} this week`}
                        </Text>
                        <Text
                          style={[
                            textStyles['body-sm'],
                            { color: p['ink-muted'], fontVariant: ['tabular-nums'] },
                          ]}
                        >
                          {league.member_count}{' '}
                          {language === 'es'
                            ? league.member_count === 1
                              ? 'miembro'
                              : 'miembros'
                            : league.member_count === 1
                              ? 'member'
                              : 'members'}
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
          {t('You have no leagues yet.', 'Aún no tienes ligas.')}
        </Text>
        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
          {t(
            'Create a league for your friends or join one with an invitation link.',
            'Crea una liga para tus amigos o únete con un enlace de invitación.',
          )}
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
    if (detail.isPending)
      return <ActivityIndicator accessibilityLabel={t('Loading league', 'Cargando liga')} />;
    if (detail.isError || !detail.data)
      return (
        <>
          {button(t('Retry', 'Reintentar'), () => {
            void detail.refetch();
          })}
          <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
            {t('Could not load league.', 'No se pudo cargar la liga.')}
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
            {field(t('League name', 'Nombre de la liga'), name, setName)}
            {descriptionField(description ?? '')}
            {renderDetailError()}
            {button(
              save.isPending ? t('Saving…', 'Guardando…') : t('Save', 'Guardar'),
              () => {
                const result = nameSchema.safeParse(name);
                if (!result.success) {
                  setError(
                    language === 'es' && result.error.issues[0].message === 'Enter a league name.'
                      ? 'Introduce un nombre para la liga.'
                      : result.error.issues[0].message,
                  );
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
                  label={t('Generate invitation', 'Generar invitación')}
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
          {field(t('League name', 'Nombre de la liga'), name, setName)}
          {descriptionField(description ?? '')}
          <LeagueTimezonePicker value={timezone} onChange={setTimezone} disabled={pending} />
          {error ? (
            <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
              {error}
            </Text>
          ) : null}
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            {t(
              'The timezone cannot be changed after creation.',
              'La zona horaria no se puede cambiar después de crear la liga.',
            )}
          </Text>
          {button(
            create.isPending ? t('Creating…', 'Creando…') : t('Create league', 'Crear liga'),
            () => {
              const result = createSchema.safeParse({
                name,
                timezone,
                description: description?.trim() || null,
              });
              if (!result.success) {
                setError(
                  language === 'es' && result.error.issues[0].message === 'Enter a league name.'
                    ? 'Introduce un nombre para la liga.'
                    : result.error.issues[0].message,
                );
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
              label={t('Create league', 'Crear liga')}
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
              label={t('Join a league', 'Unirse a una liga')}
              icon="link-outline"
              onPress={() => {
                setJoinOpen(true);
                setError('');
              }}
            />
          </View>
        </View>
        <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
          {t('Your leagues', 'Tus ligas')}
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
            title={t('Join a league', 'Unirse a una liga')}
            onClose={() => {
              setJoinOpen(false);
              setError('');
            }}
          >
            {field(
              t('Invitation link or token', 'Enlace o código de invitación'),
              input,
              (value) => {
                setInput(value);
                setError('');
              },
            )}
            {error ? (
              <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
                {error}
              </Text>
            ) : null}
            <LeagueAction
              label={t('Preview invitation', 'Ver invitación')}
              variant="primary"
              onPress={() => {
                const value = invitationToken(input);
                if (!value) {
                  setError(
                    t(
                      'Enter an invitation link or token.',
                      'Introduce un enlace o código de invitación.',
                    ),
                  );
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
            error={preview.isError ? message(preview.error, language) : error || undefined}
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
