import type { Language } from '@/i18n/Language';
import { getTranslation } from '@/i18n/catalog';
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

function objectiveLabel(objective: RecommendationData['objective'], language: Language) {
  if (!objective)
    return getTranslation(language)('nutrition.NutritionGoalRecommendation.dailyTarget');
  return language === 'es' ? objectiveLabelsEs[objective] : objectiveLabels[objective];
}

function translatedReason(data: RecommendationData, language: Language) {
  if (language !== 'es') return data.reason;
  if (data.reason_code && reasonLabelsEs[data.reason_code]) return reasonLabelsEs[data.reason_code];
  return data.reason ? (reasonTextEs[data.reason] ?? data.reason) : data.reason;
}

function translatedMissingField(field: string, language: Language) {
  if (language !== 'es') return field.replaceAll('_', ' ');
  return missingLabelsEs[field] ?? field.replaceAll('_', ' ');
}

function targetComparison(suggestion: number, saved: number, language: Language): string {
  if (saved === suggestion)
    return getTranslation(language)('nutrition.NutritionGoalRecommendation.matchesYourSavedTarget');
  const difference = Number(Math.abs(suggestion - saved).toFixed(2));
  const direction = suggestion > saved ? 'above' : 'below';
  const localizedDirection = selectCopy(
    language === 'es',
    suggestion > saved ? 'por encima' : 'por debajo',
    direction,
  );
  return getTranslation(language)('dynamicMessages.suggestionKcalDayYourSavedTarget_c5d826', {
    value1: difference,
    value2: localizedDirection,
  });
}

function adjustmentText(percent: number | null, language: Language): string {
  if (percent === 0)
    return getTranslation(language)(
      'nutrition.NutritionGoalRecommendation.caloriesToMaintainYourWeight',
    );
  const direction = Number(percent) < 0 ? 'fewer' : 'more';
  const localizedDirection = selectCopy(
    language === 'es',
    Number(percent) < 0 ? 'menos' : 'más',
    direction,
  );
  return getTranslation(language)('dynamicMessages.caloriesForYourGoal_2a23a6', {
    value1: Math.abs(percent ?? 0),
    value2: localizedDirection,
  });
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
  const language = useLanguage();
  const goal = data.goal;
  return (
    <>
      {data.available && goal ? (
        <>
          <View style={[styles.card, { backgroundColor: p['surface-200'] }]}>
            <Text style={[textStyles['title-md'], { color: p.ink }]}>
              {objectiveLabel(data.objective, language)}
            </Text>
            <Text style={[textStyles['metric-lg'], { color: p['brand-ink'] }]}>
              {goal.calories}{' '}
              {getTranslation(language)('nutrition.NutritionGoalRecommendation.kcalDay')}
            </Text>
            {(['protein', 'carbohydrates', 'fats'] as const).map((macro) => (
              <Text key={macro} style={[textStyles.body, { color: p.ink }]}>
                {language === 'es' ? macroLabelsEs[macro] : macroLabels[macro]}:{' '}
                {Math.round(goal[macro])} g{' · '}
                {Math.round(((goal[macro] * (macro === 'fats' ? 9 : 4)) / goal.calories) * 100)}%
              </Text>
            ))}
            {saved ? (
              <View style={{ gap: spacing['space-1'] }}>
                <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                  {getTranslation(language)(
                    'nutrition.NutritionGoalRecommendation.yourSavedTarget',
                  )}{' '}
                  {saved.calories}{' '}
                  {getTranslation(language)('nutrition.NutritionGoalRecommendation.kcalDay')}
                </Text>
                <Text style={[textStyles['body-sm'], { color: p.ink }]}>
                  {targetComparison(goal.calories, saved.calories, language)}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.card, { backgroundColor: p['surface-200'] }]}>
            <Text style={[textStyles.body, { color: p.ink }]}>
              {getTranslation(language)('nutrition.NutritionGoalRecommendation.weeklyActivity')}{' '}
              {language === 'es'
                ? (activityLabelsEs[String(data.activity_factor)] ?? 'Sin definir')
                : (weeklyActivityLabels[String(data.activity_factor)] ?? 'Not set')}
            </Text>
            <Text style={[textStyles.body, { color: p.ink }]}>
              {getTranslation(language)('nutrition.NutritionGoalRecommendation.maintenance')}{' '}
              {Math.round(data.maintenance_calories ?? 0)}{' '}
              {getTranslation(language)('nutrition.NutritionGoalRecommendation.kcalDay')}
            </Text>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              {adjustmentText(data.adjustment_percent, language)}
            </Text>
          </View>
          <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
            {getTranslation(language)(
              'nutrition.NutritionGoalRecommendation.aStartingEstimateReviewYourProgressIn24Weeks',
            )}
          </Text>
          <View style={styles.confirm}>
            <Switch
              accessibilityLabel={getTranslation(language)(
                'nutrition.NutritionGoalRecommendation.thisAdultEstimateIsAppropriateForMe',
              )}
              value={eligible}
              onValueChange={setEligible}
              disabled={pending}
            />
            <Text style={[textStyles['body-sm'], { color: p.ink, flex: 1 }]}>
              {getTranslation(language)(
                'nutrition.NutritionGoalRecommendation.notPregnantOrBreastfeedingNoPrescribedDiet',
              )}
            </Text>
          </View>
          <Button
            title={
              pending
                ? getTranslation(language)('nutrition.NutritionGoalRecommendation.saving')
                : getTranslation(language)('nutrition.NutritionGoalRecommendation.acceptSuggestion')
            }
            disabled={!eligible || pending}
            onPress={() => {
              onAccept();
            }}
          />
          {saved ? (
            <Text style={{ color: p['ink-muted'] }}>
              {getTranslation(language)(
                'nutrition.NutritionGoalRecommendation.thisReplacesYourCurrentTargets',
              )}
            </Text>
          ) : null}
        </>
      ) : (
        <View style={[styles.card, { backgroundColor: p['surface-200'] }]}>
          <Text style={[textStyles.body, { color: p.ink }]}>
            {translatedReason(data, language)}
          </Text>
          {data.missing_fields.length ? (
            <Text style={{ color: p['ink-muted'] }}>
              {getTranslation(language)('nutrition.NutritionGoalRecommendation.missing')}{' '}
              {data.missing_fields
                .map((field) => translatedMissingField(field, language))
                .join(', ')}
              .{' '}
              {getTranslation(language)(
                'nutrition.NutritionGoalRecommendation.updateTheseInProfileThenReturnHere',
              )}
            </Text>
          ) : null}
        </View>
      )}
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        {getTranslation(language)(
          'nutrition.NutritionGoalRecommendation.forHealthyAdultsIncludesExerciseCalories',
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
  const language = useLanguage();
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
          title={getTranslation(language)(
            'nutrition.NutritionGoalRecommendation.yourNutritionPlan',
          )}
          leading={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={getTranslation(language)(
                'nutrition.NutritionGoalRecommendation.back',
              )}
              disabled={accept.isPending}
              onPress={onClose}
              style={styles.back}
            >
              <Feather name="arrow-left" size={24} color={p.ink} />
            </Pressable>
          }
        />
        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
          {getTranslation(language)(
            'nutrition.NutritionGoalRecommendation.yourSuggestedDailyCaloriesAndMacros',
          )}
        </Text>
        {loading ? (
          <Text style={{ color: p.ink }}>
            {getTranslation(language)(
              'nutrition.NutritionGoalRecommendation.calculatingYourSuggestion',
            )}
          </Text>
        ) : null}
        {failed ? (
          <View style={styles.content}>
            <Text accessibilityRole="alert" style={{ color: p.danger }}>
              {getTranslation(language)(
                'nutrition.NutritionGoalRecommendation.couldNotLoadYourSuggestion',
              )}
            </Text>
            <Button
              title={getTranslation(language)('nutrition.NutritionGoalRecommendation.retry')}
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
            {getTranslation(language)(
              'nutrition.NutritionGoalRecommendation.couldNotSaveYourGoalTryAgain',
            )}
          </Text>
        ) : null}
        <Button
          title={getTranslation(language)('nutrition.NutritionGoalRecommendation.enterManually')}
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
