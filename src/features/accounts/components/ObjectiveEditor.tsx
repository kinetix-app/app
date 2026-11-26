import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '@/i18n/Language';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { ProfileBack } from './ProfileBack';
import { ScreenHeader } from '@/components/ScreenHeader';
import { textStyles, usePalette } from '@/theme/tokens';
import { getAccount, getObjective, setObjective } from '../api';
import type { Account, Objective } from '../schemas';
import { SetupButton, setupStyles as s } from './SetupUI';

export const objectiveOptions: {
  value: Objective;
  label: string;
  description: string;
  labelEs: string;
  descriptionEs: string;
}[] = [
  {
    value: 'build_muscle',
    label: 'Build muscle',
    labelEs: 'Ganar músculo',
    descriptionEs: 'Favorece el crecimiento muscular y la fuerza.',
    description: 'Support muscle growth and strength.',
  },
  {
    value: 'lose_fat',
    label: 'Lose fat',
    labelEs: 'Perder grasa',
    descriptionEs: 'Céntrate en reducir la grasa corporal.',
    description: 'Focus on reducing body fat.',
  },
  {
    value: 'gain_weight',
    label: 'Gain weight',
    labelEs: 'Ganar peso',
    descriptionEs: 'Trabaja para aumentar tu peso corporal.',
    description: 'Work towards gaining body weight.',
  },
  {
    value: 'maintain_weight',
    label: 'Maintain weight',
    labelEs: 'Mantener peso',
    descriptionEs: 'Mantén tu peso estable.',
    description: 'Keep your weight steady.',
  },
];
type ObjectiveEditorProps = Readonly<{
  accountId: number;
  onSaved: (account: Account) => void;
  onCancel?: () => void;
  active?: boolean;
}>;

export function ObjectiveEditor({
  accountId,
  onSaved,
  onCancel,
  active = true,
}: ObjectiveEditorProps) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const cache = useQueryClient();
  const [selected, setSelected] = useState<Objective | null>(null);
  const busy = useRef(false);
  const query = useQuery({
    queryKey: ['accounts', accountId, 'objective'],
    queryFn: ({ signal }) => getObjective(signal),
  });
  const choice = selected ?? query.data?.objective ?? null;
  const mutation = useMutation({
    mutationFn: async (objective: Objective) => {
      const result = await setObjective(objective);
      cache.setQueryData(['accounts', accountId, 'objective'], result);
      // Completion is server-derived; a failed refresh retains the selection for retry.
      return getAccount();
    },
    onSuccess: (account) => onSaved(account),
  });
  useHardwareBack(
    () => {
      if (!mutation.isPending) onCancel?.();
      return true;
    },
    active && Boolean(onCancel),
  );
  async function save() {
    if (busy.current || !choice) return;
    busy.current = true;
    try {
      await mutation.mutateAsync(choice);
    } catch {
      /* Visible error below. */
    } finally {
      busy.current = false;
    }
  }
  function renderObjectiveChoices() {
    if (query.isPending)
      return (
        <ActivityIndicator
          accessibilityLabel={es ? 'Cargando objetivo' : 'Loading objective'}
          color={p.brand}
        />
      );
    if (query.isError)
      return (
        <>
          <Text accessibilityRole="alert" style={{ color: p.danger }}>
            {es ? 'No se pudo cargar tu objetivo.' : 'Could not load your objective.'}
          </Text>
          <SetupButton
            title={es ? 'Reintentar' : 'Retry'}
            secondary
            onPress={() => {
              void query.refetch();
            }}
          />
        </>
      );
    return (
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={es ? 'Objetivo' : 'Objective'}
        style={{ gap: 12 }}
      >
        {objectiveOptions.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={es ? option.labelEs : option.label}
            aria-checked={choice === option.value}
            accessibilityState={{
              checked: choice === option.value,
              selected: choice === option.value,
              disabled: mutation.isPending,
            }}
            disabled={mutation.isPending}
            onPress={() => setSelected(option.value)}
            style={[
              s.card,
              {
                borderWidth: 1,
                borderColor: choice === option.value ? p.brand : p['line-strong'],
                backgroundColor: choice === option.value ? p['brand-soft'] : p['surface-200'],
              },
            ]}
          >
            <Text
              style={[
                textStyles['title-md'],
                { color: choice === option.value ? p['brand-ink'] : p.ink },
              ]}
            >
              {es ? option.labelEs : option.label}
              {choice === option.value ? ' ✓' : ''}
            </Text>
            <Text
              style={[
                textStyles.body,
                { color: choice === option.value ? p['brand-ink'] : p['ink-muted'] },
              ]}
            >
              {es ? option.descriptionEs : option.description}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }
  return (
    <SafeAreaView
      edges={onCancel ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
      style={[s.screen, { backgroundColor: p['surface-100'] }]}
    >
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader
          title={es ? '¿Cuál es tu objetivo?' : "What's your goal?"}
          leading={
            onCancel ? <ProfileBack onPress={onCancel} disabled={mutation.isPending} /> : undefined
          }
        />
        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
          {es
            ? 'Elige tu objetivo. Puedes cambiarlo cuando quieras. El objetivo nutricional numérico es opcional y puedes fijarlo más adelante.'
            : 'Choose your objective. You can change it anytime. A numerical nutrition target is optional and can be set later.'}
        </Text>
        {renderObjectiveChoices()}
        {mutation.isError ? (
          <Text accessibilityRole="alert" style={{ color: p.danger }}>
            {es
              ? 'No se pudo guardar tu objetivo. Conservamos tu selección. Inténtalo de nuevo.'
              : 'Could not finish saving your objective. Your selection is kept. Try again.'}
          </Text>
        ) : null}
        <SetupButton
          title={
            mutation.isPending
              ? es
                ? 'Guardando…'
                : 'Saving…'
              : es
                ? 'Guardar objetivo'
                : 'Save objective'
          }
          disabled={!choice || query.isPending || query.isError || mutation.isPending}
          onPress={() => {
            void save();
          }}
        />
        {onCancel ? (
          <SetupButton
            title={es ? 'Cancelar' : 'Cancel'}
            secondary
            disabled={mutation.isPending}
            onPress={onCancel}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
