import { getTranslation } from '@/i18n/catalog';
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
  const language = useLanguage();
  const es = language === 'es';
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
          accessibilityLabel={getTranslation(language)('accountsUi.loading_objective')}
          color={p.brand}
        />
      );
    if (query.isError)
      return (
        <>
          <Text accessibilityRole="alert" style={{ color: p.danger }}>
            {getTranslation(language)('accountsUi.could_not_load_your_objective')}
          </Text>
          <SetupButton
            title={getTranslation(language)('accountsUi.retry')}
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
        accessibilityLabel={getTranslation(language)('accountsUi.objective')}
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
          title={getTranslation(language)('accountsUi.what_s_your_goal')}
          leading={
            onCancel ? <ProfileBack onPress={onCancel} disabled={mutation.isPending} /> : undefined
          }
        />
        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
          {getTranslation(language)(
            'accountsUi.choose_your_objective_you_can_change_it_anytime_a_numerical_',
          )}
        </Text>
        {renderObjectiveChoices()}
        {mutation.isError ? (
          <Text accessibilityRole="alert" style={{ color: p.danger }}>
            {getTranslation(language)(
              'accountsUi.could_not_finish_saving_your_objective_your_selection_is_kep',
            )}
          </Text>
        ) : null}
        <SetupButton
          title={
            mutation.isPending
              ? getTranslation(language)('accountsUi.saving')
              : getTranslation(language)('accountsUi.save_objective')
          }
          disabled={!choice || query.isPending || query.isError || mutation.isPending}
          onPress={() => {
            void save();
          }}
        />
        {onCancel ? (
          <SetupButton
            title={getTranslation(language)('accountsUi.cancel')}
            secondary
            disabled={mutation.isPending}
            onPress={onCancel}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
