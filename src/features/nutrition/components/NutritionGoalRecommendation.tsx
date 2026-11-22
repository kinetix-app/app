import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const goal = data?.goal;
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p['surface-100'] }]}>
      <ScrollView contentContainerStyle={[screenContentStyle, styles.content]}>
        <ScreenHeader
          title="Your nutrition plan"
          leading={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              disabled={accept.isPending}
              onPress={onClose}
              style={styles.back}
            >
              <Feather name="arrow-left" size={24} color={p.ink} />
            </Pressable>
          }
        />
        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
          Your suggested daily calories and macros.
        </Text>
        {loading ? <Text style={{ color: p.ink }}>Calculating your suggestion…</Text> : null}
        {failed ? (
          <View style={styles.content}>
            <Text accessibilityRole="alert" style={{ color: p.danger }}>
              Could not load your suggestion.
            </Text>
            <Button
              title="Retry"
              onPress={() => {
                void recommendation.refetch();
                void saved.refetch();
              }}
            />
          </View>
        ) : null}
        {!loading && !failed && data ? (
          <>
            {data.available && goal ? (
              <>
                <View style={[styles.card, { backgroundColor: p['surface-200'] }]}>
                  <Text style={[textStyles['title-md'], { color: p.ink }]}>
                    {data.objective ? objectiveLabels[data.objective] : 'Daily target'}
                  </Text>
                  <Text style={[textStyles['metric-lg'], { color: p['brand-ink'] }]}>
                    {goal.calories} kcal/day
                  </Text>
                  {(['protein', 'carbohydrates', 'fats'] as const).map((macro) => (
                    <Text key={macro} style={[textStyles.body, { color: p.ink }]}>
                      {macro === 'protein' ? 'Protein' : macro === 'fats' ? 'Fat' : 'Carbohydrates'}
                      : {Math.round(goal[macro])} g{' · '}
                      {Math.round(
                        ((goal[macro] * (macro === 'fats' ? 9 : 4)) / goal.calories) * 100,
                      )}
                      %
                    </Text>
                  ))}
                  {saved.data ? (
                    <View style={{ gap: spacing['space-1'] }}>
                      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                        Your saved target: {saved.data.calories} kcal/day
                      </Text>
                      <Text style={[textStyles['body-sm'], { color: p.ink }]}>
                        {saved.data.calories === goal.calories
                          ? 'Matches your saved target.'
                          : `Suggestion: ${Number(Math.abs(goal.calories - saved.data.calories).toFixed(2))} kcal/day ${goal.calories > saved.data.calories ? 'above' : 'below'} your saved target.`}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={[styles.card, { backgroundColor: p['surface-200'] }]}>
                  <Text style={[textStyles.body, { color: p.ink }]}>
                    Weekly activity:{' '}
                    {weeklyActivityLabels[String(data.activity_factor)] ?? 'Not set'}
                  </Text>
                  <Text style={[textStyles.body, { color: p.ink }]}>
                    Maintenance: {Math.round(data.maintenance_calories ?? 0)} kcal/day
                  </Text>
                  <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                    {data.adjustment_percent === 0
                      ? 'Calories to maintain your weight.'
                      : `${Math.abs(data.adjustment_percent ?? 0)}% ${Number(data.adjustment_percent) < 0 ? 'fewer' : 'more'} calories for your goal.`}
                  </Text>
                </View>
                <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
                  A starting estimate. Review your progress in 2–4 weeks.
                </Text>
                <View style={styles.confirm}>
                  <Switch
                    accessibilityLabel="This adult estimate is appropriate for me"
                    value={eligible}
                    onValueChange={setEligible}
                    disabled={accept.isPending}
                  />
                  <Text style={[textStyles['body-sm'], { color: p.ink, flex: 1 }]}>
                    Not pregnant or breastfeeding. No prescribed diet.
                  </Text>
                </View>
                <Button
                  title={accept.isPending ? 'Saving…' : 'Accept suggestion'}
                  disabled={!eligible || accept.isPending}
                  onPress={() => {
                    if (busy.current) return;
                    busy.current = true;
                    accept.mutate();
                  }}
                />
                {saved.data ? (
                  <Text style={{ color: p['ink-muted'] }}>This replaces your current targets.</Text>
                ) : null}
              </>
            ) : (
              <View style={[styles.card, { backgroundColor: p['surface-200'] }]}>
                <Text style={[textStyles.body, { color: p.ink }]}>{data.reason}</Text>
                {data.missing_fields.length ? (
                  <Text style={{ color: p['ink-muted'] }}>
                    Missing:{' '}
                    {data.missing_fields.map((field) => field.replaceAll('_', ' ')).join(', ')}.
                    Update these in Profile, then return here.
                  </Text>
                ) : null}
              </View>
            )}
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              For healthy adults. Includes exercise calories.
            </Text>
          </>
        ) : null}
        {accept.isError ? (
          <Text accessibilityRole="alert" style={{ color: p.danger }}>
            Could not save your goal. Try again.
          </Text>
        ) : null}
        <Button
          title="Enter manually"
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
