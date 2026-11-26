import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { selectCopy, useLanguage } from '@/i18n/Language';
import { Button } from '@/components/Button';
import { ScreenHeader, screenContentStyle } from '@/components/ScreenHeader';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { nutritionApi } from '../api';
import { NutritionGoalEditor } from './NutritionGoalEditor';

const objectiveLabels = {
  lose_fat: 'Lose fat',
  build_muscle: 'Build muscle',
  gain_weight: 'Gain weight',
  maintain_weight: 'Maintain weight',
};

const weeklyActivityLabels: Record<string, string> = {
  '1.2': 'Sedentary',
  '1.375': 'Light',
  '1.55': 'Moderate',
  '1.725': 'High',
  '1.9': 'Very high',
};

const macroLabels = { protein: 'Protein', carbohydrates: 'Carbohydrates', fats: 'Fat' } as const;
const objectiveLabelsEs = {
  lose_fat: 'Perder grasa',
  build_muscle: 'Ganar músculo',
  gain_weight: 'Ganar peso',
  maintain_weight: 'Mantener el peso',
} as const;
const activityLabelsEs: Record<string, string> = {
  '1.2': 'Sedentaria',
  '1.375': 'Ligera',
  '1.55': 'Moderada',
  '1.725': 'Alta',
  '1.9': 'Muy alta',
};
const macroLabelsEs = {
  protein: 'Proteínas',
  carbohydrates: 'Carbohidratos',
  fats: 'Grasas',
} as const;
const reasonLabelsEs: Record<string, string> = {
  incomplete_profile: 'Completa tu perfil y selecciona un objetivo para obtener una sugerencia.',
  underage: 'Las sugerencias automáticas están disponibles para mayores de 18 años.',
  measurements_need_assessment:
    'Tus medidas requieren una evaluación individual antes de establecer un objetivo.',
  missing_sex_or_activity: 'Actualiza tu sexo y nivel de actividad en Perfil.',
  estimate_needs_assessment:
    'Esta estimación requiere una evaluación individual antes de establecer un objetivo.',
};
const reasonTextEs: Record<string, string> = {
  'Complete your profile and select an objective to get a suggestion.':
    reasonLabelsEs.incomplete_profile,
  'Automatic suggestions are available for adults aged 18 or older.': reasonLabelsEs.underage,
  'Your measurements need an individual assessment before setting a target.':
    reasonLabelsEs.measurements_need_assessment,
  'Update your sex and activity level in Profile.': reasonLabelsEs.missing_sex_or_activity,
  'This estimate needs an individual assessment before setting a target.':
    reasonLabelsEs.estimate_needs_assessment,
};
const missingLabelsEs: Record<string, string> = {
  activity_level: 'nivel de actividad',
  age: 'edad',
  height_cm: 'altura',
  weight_kg: 'peso',
  objective: 'objetivo',
  sex: 'sexo',
  weight: 'peso',
  height: 'altura',
  birth_date: 'fecha de nacimiento',
};

function objectiveLabel(objective: RecommendationData['objective'], es: boolean) {
  if (!objective) return selectCopy(es, 'Objetivo diario', 'Daily target');
  return es ? objectiveLabelsEs[objective] : objectiveLabels[objective];
}

function translatedReason(data: RecommendationData, es: boolean) {
  if (!es) return data.reason;
  if (data.reason_code && reasonLabelsEs[data.reason_code]) return reasonLabelsEs[data.reason_code];
  return data.reason ? (reasonTextEs[data.reason] ?? data.reason) : data.reason;
}

function translatedMissingField(field: string, es: boolean) {
  if (!es) return field.replaceAll('_', ' ');
  return missingLabelsEs[field] ?? field.replaceAll('_', ' ');
}

function targetComparison(suggestion: number, saved: number, es: boolean): string {
  if (saved === suggestion)
    return selectCopy(es, 'Coincide con tu objetivo guardado.', 'Matches your saved target.');
  const difference = Number(Math.abs(suggestion - saved).toFixed(2));
  const direction = suggestion > saved ? 'above' : 'below';
  const localizedDirection = selectCopy(
    es,
    suggestion > saved ? 'por encima' : 'por debajo',
    direction,
  );
  return selectCopy(
    es,
    `Sugerencia: ${difference} kcal/día ${localizedDirection} de tu objetivo guardado.`,
    `Suggestion: ${difference} kcal/day ${localizedDirection} your saved target.`,
  );
}

function adjustmentText(percent: number | null, es: boolean): string {
  if (percent === 0)
    return selectCopy(es, 'Calorías para mantener tu peso.', 'Calories to maintain your weight.');
  const direction = Number(percent) < 0 ? 'fewer' : 'more';
  const localizedDirection = selectCopy(es, Number(percent) < 0 ? 'menos' : 'más', direction);
  return selectCopy(
    es,
    `${Math.abs(percent ?? 0)} % ${localizedDirection} calorías para tu objetivo.`,
    `${Math.abs(percent ?? 0)}% ${localizedDirection} calories for your goal.`,
  );
}

type RecommendationData = Awaited<ReturnType<typeof nutritionApi.recommendation>>;
type SavedGoal = Awaited<ReturnType<typeof nutritionApi.goal>>;

function RecommendationContent({
  data,
  saved,
  eligible,
  setEligible,
  pending,
  onAccept,
}: Readonly<{
  data: RecommendationData;
  saved: SavedGoal | undefined;
  eligible: boolean;
  setEligible: (value: boolean) => void;
  pending: boolean;
  onAccept: () => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const goal = data.goal;
  return (
    <>
      {data.available && goal ? (
        <>
          <View style={[styles.card, { backgroundColor: p['surface-200'] }]}>
            <Text style={[textStyles['title-md'], { color: p.ink }]}>
              {objectiveLabel(data.objective, es)}
            </Text>
            <Text style={[textStyles['metric-lg'], { color: p['brand-ink'] }]}>
              {goal.calories} {selectCopy(es, 'kcal/día', 'kcal/day')}
            </Text>
            {(['protein', 'carbohydrates', 'fats'] as const).map((macro) => (
              <Text key={macro} style={[textStyles.body, { color: p.ink }]}>
                {es ? macroLabelsEs[macro] : macroLabels[macro]}: {Math.round(goal[macro])} g{' · '}
                {Math.round(((goal[macro] * (macro === 'fats' ? 9 : 4)) / goal.calories) * 100)}%
              </Text>
            ))}
            {saved ? (
              <View style={{ gap: spacing['space-1'] }}>
                <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                  {selectCopy(es, 'Tu objetivo guardado:', 'Your saved target:')} {saved.calories}{' '}
                  {selectCopy(es, 'kcal/día', 'kcal/day')}
                </Text>
                <Text style={[textStyles['body-sm'], { color: p.ink }]}>
                  {targetComparison(goal.calories, saved.calories, es)}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.card, { backgroundColor: p['surface-200'] }]}>
            <Text style={[textStyles.body, { color: p.ink }]}>
              {selectCopy(es, 'Actividad semanal:', 'Weekly activity:')}{' '}
              {es
                ? (activityLabelsEs[String(data.activity_factor)] ?? 'Sin definir')
                : (weeklyActivityLabels[String(data.activity_factor)] ?? 'Not set')}
            </Text>
            <Text style={[textStyles.body, { color: p.ink }]}>
              {selectCopy(es, 'Mantenimiento:', 'Maintenance:')}{' '}
              {Math.round(data.maintenance_calories ?? 0)} {selectCopy(es, 'kcal/día', 'kcal/day')}
            </Text>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              {adjustmentText(data.adjustment_percent, es)}
            </Text>
          </View>
          <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
            {selectCopy(
              es,
              'Una estimación inicial. Revisa tu progreso en 2–4 semanas.',
              'A starting estimate. Review your progress in 2–4 weeks.',
            )}
          </Text>
          <View style={styles.confirm}>
            <Switch
              accessibilityLabel={selectCopy(
                es,
                'Esta estimación para adultos es adecuada para mí',
                'This adult estimate is appropriate for me',
              )}
              value={eligible}
              onValueChange={setEligible}
              disabled={pending}
            />
            <Text style={[textStyles['body-sm'], { color: p.ink, flex: 1 }]}>
              {selectCopy(
                es,
                'No estoy embarazada ni en periodo de lactancia. No sigo una dieta prescrita.',
                'Not pregnant or breastfeeding. No prescribed diet.',
              )}
            </Text>
          </View>
          <Button
            title={
              pending
                ? selectCopy(es, 'Guardando…', 'Saving…')
                : selectCopy(es, 'Aceptar sugerencia', 'Accept suggestion')
            }
            disabled={!eligible || pending}
            onPress={() => {
              onAccept();
            }}
          />
          {saved ? (
            <Text style={{ color: p['ink-muted'] }}>
              {selectCopy(
                es,
                'Esto sustituye tus objetivos actuales.',
                'This replaces your current targets.',
              )}
            </Text>
          ) : null}
        </>
      ) : (
        <View style={[styles.card, { backgroundColor: p['surface-200'] }]}>
          <Text style={[textStyles.body, { color: p.ink }]}>{translatedReason(data, es)}</Text>
          {data.missing_fields.length ? (
            <Text style={{ color: p['ink-muted'] }}>
              {selectCopy(es, 'Faltan:', 'Missing:')}{' '}
              {data.missing_fields.map((field) => translatedMissingField(field, es)).join(', ')}.{' '}
              {selectCopy(
                es,
                'Actualízalos en Perfil y vuelve aquí.',
                'Update these in Profile, then return here.',
              )}
            </Text>
          ) : null}
        </View>
      )}
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        {selectCopy(
          es,
          'Para adultos sanos. Incluye las calorías del ejercicio.',
          'For healthy adults. Includes exercise calories.',
        )}
      </Text>
    </>
  );
}

export function NutritionGoalRecommendation(
  props: Readonly<{
    accountId: number;
    onClose: () => void;
    active?: boolean;
  }>,
) {
  return <Recommendation key={props.accountId} {...props} />;
}

function Recommendation({
  accountId,
  onClose,
  active = true,
}: Readonly<{
  accountId: number;
  onClose: () => void;
  active?: boolean;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const cache = useQueryClient();
  const [manual, setManual] = React.useState(false);
  const [eligible, setEligible] = React.useState(false);
  const busy = React.useRef(false);
  const recommendation = useQuery({
    queryKey: ['nutrition', accountId, 'recommendation'],
    queryFn: ({ signal }) => nutritionApi.recommendation(signal),
    retry: false,
    staleTime: 0,
  });
  const saved = useQuery({
    queryKey: ['nutrition', accountId, 'goal'],
    queryFn: ({ signal }) => nutritionApi.goal(signal),
    retry: false,
  });
  const accept = useMutation({
    mutationFn: async () => {
      const goal = recommendation.data?.goal;
      if (!goal) throw new Error('No suggestion available');
      return saved.data ? nutritionApi.updateGoal(goal) : nutritionApi.createGoal(goal);
    },
    onSuccess: (goal) => {
      cache.setQueryData(['nutrition', accountId, 'goal'], goal);
      onClose();
    },
    onSettled: () => {
      busy.current = false;
    },
  });
  useHardwareBack(() => {
    if (!accept.isPending) onClose();
    return true;
  }, active && !manual);
  if (manual)
    return (
      <NutritionGoalEditor accountId={accountId} active={active} onClose={() => setManual(false)} />
    );
  const data = recommendation.data;
  const loading = recommendation.isPending || saved.isPending;
  const failed = recommendation.isError || saved.isError;
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p['surface-100'] }]}>
      <ScrollView contentContainerStyle={[screenContentStyle, styles.content]}>
        <ScreenHeader
          title={selectCopy(es, 'Tu plan nutricional', 'Your nutrition plan')}
          leading={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={selectCopy(es, 'Volver', 'Back')}
              disabled={accept.isPending}
              onPress={onClose}
              style={styles.back}
            >
              <Feather name="arrow-left" size={24} color={p.ink} />
            </Pressable>
          }
        />
        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
          {selectCopy(
            es,
            'Tus calorías y macronutrientes diarios sugeridos.',
            'Your suggested daily calories and macros.',
          )}
        </Text>
        {loading ? (
          <Text style={{ color: p.ink }}>
            {selectCopy(es, 'Calculando tu sugerencia…', 'Calculating your suggestion…')}
          </Text>
        ) : null}
        {failed ? (
          <View style={styles.content}>
            <Text accessibilityRole="alert" style={{ color: p.danger }}>
              {selectCopy(
                es,
                'No se pudo cargar tu sugerencia.',
                'Could not load your suggestion.',
              )}
            </Text>
            <Button
              title={selectCopy(es, 'Reintentar', 'Retry')}
              onPress={() => {
                void recommendation.refetch();
                void saved.refetch();
              }}
            />
          </View>
        ) : null}
        {!loading && !failed && data ? (
          <RecommendationContent
            data={data}
            saved={saved.data}
            eligible={eligible}
            setEligible={setEligible}
            pending={accept.isPending}
            onAccept={() => {
              if (busy.current) return;
              busy.current = true;
              accept.mutate();
            }}
          />
        ) : null}
        {accept.isError ? (
          <Text accessibilityRole="alert" style={{ color: p.danger }}>
            {selectCopy(
              es,
              'No se pudo guardar tu objetivo. Inténtalo de nuevo.',
              'Could not save your goal. Try again.',
            )}
          </Text>
        ) : null}
        <Button
          title={selectCopy(es, 'Introducir manualmente', 'Enter manually')}
          secondary
          disabled={accept.isPending}
          onPress={() => setManual(true)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: spacing['space-4'], paddingBottom: spacing['space-6'] },
  card: { padding: spacing['space-5'], borderRadius: radii['radius-lg'], gap: spacing['space-3'] },
  back: {
    minWidth: sizes['tap-min'],
    minHeight: sizes['tap-min'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-3'] },
});
