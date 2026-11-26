import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '@/i18n/Language';
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

function targetComparison(suggestion: number, saved: number, es: boolean): string {
  if (saved === suggestion)
    return es ? 'Coincide con tu objetivo guardado.' : 'Matches your saved target.';
  const difference = Number(Math.abs(suggestion - saved).toFixed(2));
  const direction = suggestion > saved ? 'above' : 'below';
  return es
    ? `Sugerencia: ${difference} kcal/día ${suggestion > saved ? 'por encima' : 'por debajo'} de tu objetivo guardado.`
    : `Suggestion: ${difference} kcal/day ${direction} your saved target.`;
}

function adjustmentText(percent: number | null, es: boolean): string {
  if (percent === 0)
    return es ? 'Calorías para mantener tu peso.' : 'Calories to maintain your weight.';
  const direction = Number(percent) < 0 ? 'fewer' : 'more';
  return es
    ? `${Math.abs(percent ?? 0)} % ${Number(percent) < 0 ? 'menos' : 'más'} calorías para tu objetivo.`
    : `${Math.abs(percent ?? 0)}% ${direction} calories for your goal.`;
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
              {data.objective
                ? es
                  ? {
                      lose_fat: 'Perder grasa',
                      build_muscle: 'Ganar músculo',
                      gain_weight: 'Ganar peso',
                      maintain_weight: 'Mantener el peso',
                    }[data.objective]
                  : objectiveLabels[data.objective]
                : es
                  ? 'Objetivo diario'
                  : 'Daily target'}
            </Text>
            <Text style={[textStyles['metric-lg'], { color: p['brand-ink'] }]}>
              {goal.calories} {es ? 'kcal/día' : 'kcal/day'}
            </Text>
            {(['protein', 'carbohydrates', 'fats'] as const).map((macro) => (
              <Text key={macro} style={[textStyles.body, { color: p.ink }]}>
                {es
                  ? { protein: 'Proteínas', carbohydrates: 'Carbohidratos', fats: 'Grasas' }[macro]
                  : macroLabels[macro]}
                : {Math.round(goal[macro])} g{' · '}
                {Math.round(((goal[macro] * (macro === 'fats' ? 9 : 4)) / goal.calories) * 100)}%
              </Text>
            ))}
            {saved ? (
              <View style={{ gap: spacing['space-1'] }}>
                <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                  {es ? 'Tu objetivo guardado:' : 'Your saved target:'} {saved.calories}{' '}
                  {es ? 'kcal/día' : 'kcal/day'}
                </Text>
                <Text style={[textStyles['body-sm'], { color: p.ink }]}>
                  {targetComparison(goal.calories, saved.calories, es)}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.card, { backgroundColor: p['surface-200'] }]}>
            <Text style={[textStyles.body, { color: p.ink }]}>
              {es ? 'Actividad semanal:' : 'Weekly activity:'}{' '}
              {es
                ? ((
                    {
                      '1.2': 'Sedentaria',
                      '1.375': 'Ligera',
                      '1.55': 'Moderada',
                      '1.725': 'Alta',
                      '1.9': 'Muy alta',
                    } as Record<string, string>
                  )[String(data.activity_factor)] ?? 'Sin definir')
                : (weeklyActivityLabels[String(data.activity_factor)] ?? 'Not set')}
            </Text>
            <Text style={[textStyles.body, { color: p.ink }]}>
              {es ? 'Mantenimiento:' : 'Maintenance:'} {Math.round(data.maintenance_calories ?? 0)}{' '}
              {es ? 'kcal/día' : 'kcal/day'}
            </Text>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              {adjustmentText(data.adjustment_percent, es)}
            </Text>
          </View>
          <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
            {es
              ? 'Una estimación inicial. Revisa tu progreso en 2–4 semanas.'
              : 'A starting estimate. Review your progress in 2–4 weeks.'}
          </Text>
          <View style={styles.confirm}>
            <Switch
              accessibilityLabel={
                es
                  ? 'Esta estimación para adultos es adecuada para mí'
                  : 'This adult estimate is appropriate for me'
              }
              value={eligible}
              onValueChange={setEligible}
              disabled={pending}
            />
            <Text style={[textStyles['body-sm'], { color: p.ink, flex: 1 }]}>
              {es
                ? 'No estoy embarazada ni en periodo de lactancia. No sigo una dieta prescrita.'
                : 'Not pregnant or breastfeeding. No prescribed diet.'}
            </Text>
          </View>
          <Button
            title={
              pending
                ? es
                  ? 'Guardando…'
                  : 'Saving…'
                : es
                  ? 'Aceptar sugerencia'
                  : 'Accept suggestion'
            }
            disabled={!eligible || pending}
            onPress={() => {
              onAccept();
            }}
          />
          {saved ? (
            <Text style={{ color: p['ink-muted'] }}>
              {es
                ? 'Esto sustituye tus objetivos actuales.'
                : 'This replaces your current targets.'}
            </Text>
          ) : null}
        </>
      ) : (
        <View style={[styles.card, { backgroundColor: p['surface-200'] }]}>
          <Text style={[textStyles.body, { color: p.ink }]}>
            {(es &&
              data.reason_code &&
              (
                {
                  incomplete_profile:
                    'Completa tu perfil y selecciona un objetivo para obtener una sugerencia.',
                  underage:
                    'Las sugerencias automáticas están disponibles para mayores de 18 años.',
                  measurements_need_assessment:
                    'Tus medidas requieren una evaluación individual antes de establecer un objetivo.',
                  missing_sex_or_activity: 'Actualiza tu sexo y nivel de actividad en Perfil.',
                  estimate_needs_assessment:
                    'Esta estimación requiere una evaluación individual antes de establecer un objetivo.',
                } as Record<string, string>
              )[data.reason_code]) ||
              (es && data.reason
                ? ((
                    {
                      'Complete your profile and select an objective to get a suggestion.':
                        'Completa tu perfil y selecciona un objetivo para obtener una sugerencia.',
                      'Automatic suggestions are available for adults aged 18 or older.':
                        'Las sugerencias automáticas están disponibles para mayores de 18 años.',
                      'Your measurements need an individual assessment before setting a target.':
                        'Tus medidas requieren una evaluación individual antes de establecer un objetivo.',
                      'Update your sex and activity level in Profile.':
                        'Actualiza tu sexo y nivel de actividad en Perfil.',
                      'This estimate needs an individual assessment before setting a target.':
                        'Esta estimación requiere una evaluación individual antes de establecer un objetivo.',
                    } as Record<string, string>
                  )[data.reason] ?? data.reason)
                : data.reason)}
          </Text>
          {data.missing_fields.length ? (
            <Text style={{ color: p['ink-muted'] }}>
              {es ? 'Faltan:' : 'Missing:'}{' '}
              {data.missing_fields
                .map((field) =>
                  es
                    ? ((
                        {
                          activity_level: 'nivel de actividad',
                          age: 'edad',
                          height_cm: 'altura',
                          weight_kg: 'peso',
                          objective: 'objetivo',
                          sex: 'sexo',
                          weight: 'peso',
                          height: 'altura',
                          birth_date: 'fecha de nacimiento',
                        } as Record<string, string>
                      )[field] ?? field.replaceAll('_', ' '))
                    : field.replaceAll('_', ' '),
                )
                .join(', ')}
              .{' '}
              {es
                ? 'Actualízalos en Perfil y vuelve aquí.'
                : 'Update these in Profile, then return here.'}
            </Text>
          ) : null}
        </View>
      )}
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        {es
          ? 'Para adultos sanos. Incluye las calorías del ejercicio.'
          : 'For healthy adults. Includes exercise calories.'}
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
          title={es ? 'Tu plan nutricional' : 'Your nutrition plan'}
          leading={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={es ? 'Volver' : 'Back'}
              disabled={accept.isPending}
              onPress={onClose}
              style={styles.back}
            >
              <Feather name="arrow-left" size={24} color={p.ink} />
            </Pressable>
          }
        />
        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
          {es
            ? 'Tus calorías y macronutrientes diarios sugeridos.'
            : 'Your suggested daily calories and macros.'}
        </Text>
        {loading ? (
          <Text style={{ color: p.ink }}>
            {es ? 'Calculando tu sugerencia…' : 'Calculating your suggestion…'}
          </Text>
        ) : null}
        {failed ? (
          <View style={styles.content}>
            <Text accessibilityRole="alert" style={{ color: p.danger }}>
              {es ? 'No se pudo cargar tu sugerencia.' : 'Could not load your suggestion.'}
            </Text>
            <Button
              title={es ? 'Reintentar' : 'Retry'}
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
            {es
              ? 'No se pudo guardar tu objetivo. Inténtalo de nuevo.'
              : 'Could not save your goal. Try again.'}
          </Text>
        ) : null}
        <Button
          title={es ? 'Introducir manualmente' : 'Enter manually'}
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
