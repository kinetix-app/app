import { Feather } from '@expo/vector-icons';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

import { nutritionApi } from './api';

const macros = [
  { label: 'Protein', field: 'protein', value: 112, color: 'macro-protein' },
  { label: 'Carbs', field: 'carbohydrates', value: 180, color: 'macro-carbs' },
  { label: 'Fat', field: 'fats', value: 52, color: 'macro-fat' },
] as const;

const meals = [
  {
    name: 'Breakfast',
    calories: 470,
    items: [
      { name: 'Oatmeal with banana', amount: '80 g', calories: 380 },
      { name: 'Coffee with milk', amount: '200 ml', calories: 90 },
    ],
  },
  {
    name: 'Lunch',
    calories: 790,
    items: [
      { name: 'Grilled chicken breast', amount: '200 g', calories: 330 },
      { name: 'Brown rice', amount: '180 g cooked', calories: 460 },
    ],
  },
] as const;

const week = [
  { id: '2026-10-19', weekday: 'Mon', day: '19', hasEntries: true, isToday: false },
  { id: '2026-10-20', weekday: 'Tue', day: '20', hasEntries: true, isToday: false },
  { id: '2026-10-21', weekday: 'Wed', day: '21', hasEntries: true, isToday: false },
  { id: '2026-10-22', weekday: 'Thu', day: '22', hasEntries: true, isToday: true },
  { id: '2026-10-23', weekday: 'Fri', day: '23', hasEntries: false, isToday: false },
  { id: '2026-10-24', weekday: 'Sat', day: '24', hasEntries: false, isToday: false },
  { id: '2026-10-25', weekday: 'Sun', day: '25', hasEntries: false, isToday: false },
] as const;

export function NutritionDiaryScreen({
  accountId,
  onBack,
  onEditGoal,
}: {
  accountId?: number;
  onBack?: () => void;
  onEditGoal?: () => void;
}) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 30000, gcTime: 0 } },
      }),
  );

  React.useEffect(
    () => () => {
      void client.cancelQueries();
      client.clear();
    },
    [client],
  );

  return (
    <QueryClientProvider client={client}>
      <NutritionDiary accountId={accountId} onBack={onBack} onEditGoal={onEditGoal} />
    </QueryClientProvider>
  );
}

function NutritionDiary({
  accountId,
  onBack,
  onEditGoal,
}: {
  accountId?: number;
  onBack?: () => void;
  onEditGoal?: () => void;
}) {
  const p = usePalette();
  const [selectedDay, setSelectedDay] = React.useState('2026-10-22');
  const selected = week.find((day) => day.id === selectedDay) ?? week[3];
  const goal = useQuery({
    queryKey: ['nutrition', accountId ?? 'anonymous', 'goal'],
    queryFn: ({ signal }) => nutritionApi.goal(signal),
  });
  const macroProgress = macros.map((macro) => {
    const goalValue = goal.data?.[macro.field];
    return {
      ...macro,
      goalValue,
      progress: goalValue ? Math.min((macro.value / goalValue) * 100, 100) : 0,
    };
  });

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p['surface-100'] }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.header}>
            {onBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to routines"
                onPress={onBack}
                style={({ pressed }) => [
                  styles.backButton,
                  { backgroundColor: p['surface-300'], opacity: pressed ? 0.55 : 1 },
                ]}
              >
                <Feather name="arrow-left" size={24} color={p.ink} />
              </Pressable>
            ) : null}
            <Text accessibilityRole="header" style={[textStyles['display-lg'], { color: p.ink }]}>
              Nutrition
            </Text>
            <Text style={[textStyles.label, { color: p['ink-muted'] }]}>
              {selected.isToday ? 'Today' : `${selected.weekday}, Oct ${selected.day}`}
            </Text>
          </View>

          <View accessibilityRole="tablist" accessibilityLabel="Week of October 19">
            <View style={styles.weekStrip}>
              {week.map((day) => {
                const isSelected = day.id === selectedDay;
                return (
                  <Pressable
                    key={day.id}
                    accessibilityRole="tab"
                    accessibilityLabel={`${day.weekday} October ${day.day}${day.isToday ? ', today' : ''}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSelectedDay(day.id)}
                    style={({ pressed }) => [styles.dayButton, pressed && styles.pressed]}
                  >
                    <Text
                      style={[
                        textStyles.caption,
                        { color: isSelected ? p['brand-ink'] : p['ink-muted'] },
                      ]}
                    >
                      {day.weekday}
                    </Text>
                    <View
                      style={[
                        styles.dayNumber,
                        isSelected && { backgroundColor: p['brand-soft'] },
                        day.isToday && !isSelected && { borderColor: p.brand, borderWidth: 1 },
                      ]}
                    >
                      <Text
                        style={[textStyles.label, { color: isSelected ? p['brand-ink'] : p.ink }]}
                      >
                        {day.day}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.dayMarker,
                        { backgroundColor: day.hasEntries ? p['brand-ink'] : 'transparent' },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: p['surface-200'] }]}>
            <View style={styles.calorieRow}>
              <View style={styles.calorieCopy}>
                <Text style={[textStyles['metric-md'], styles.tabular, { color: p.ink }]}>
                  1,260 kcal
                </Text>
                <Text style={[textStyles.body, styles.tabular, { color: p['ink-muted'] }]}>
                  of {goal.data ? formatNumber(goal.data.calories) : '—'} kcal
                </Text>
              </View>
              {onEditGoal ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit nutrition goal"
                  onPress={onEditGoal}
                >
                  <Text style={[textStyles.label, { color: p['brand-ink'] }]}>Edit goal</Text>
                </Pressable>
              ) : null}
            </View>
            {macroProgress.map((macro) => (
              <View key={macro.label} style={styles.macro}>
                <View style={styles.macroLabelRow}>
                  <Text style={[textStyles['title-md'], { color: p.ink }]}>{macro.label}</Text>
                  <Text style={[textStyles.body, styles.tabular, { color: p['ink-muted'] }]}>
                    {macro.value} /{' '}
                    {macro.goalValue === undefined ? '—' : formatNumber(macro.goalValue)} g
                  </Text>
                </View>
                <View
                  accessibilityLabel={`${macro.label}: ${macro.value} of ${macro.goalValue ?? 'unknown'} grams`}
                  accessibilityRole="progressbar"
                  accessibilityValue={
                    macro.goalValue === undefined
                      ? undefined
                      : { min: 0, max: macro.goalValue, now: macro.value }
                  }
                  style={[styles.progressTrack, { backgroundColor: p['surface-300'] }]}
                >
                  <View
                    style={[
                      styles.progressValue,
                      {
                        backgroundColor: p[macro.color],
                        width: `${macro.progress}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
            {goal.isError ? (
              <View style={styles.goalError}>
                <Text
                  accessibilityRole="alert"
                  style={[textStyles['body-sm'], { color: p.danger }]}
                >
                  We could not load your nutrition goal.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading nutrition goal"
                  onPress={() => void goal.refetch()}
                >
                  <Text style={[textStyles.label, { color: p['brand-ink'] }]}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {meals.map((meal) => (
            <View key={meal.name} style={styles.mealGroup}>
              <Text style={[textStyles.overline, { color: p['ink-muted'] }]}>
                {meal.name.toUpperCase()} · {meal.calories} KCAL
              </Text>
              <View style={[styles.mealCard, { backgroundColor: p['surface-200'] }]}>
                {meal.items.map((item, index) => (
                  <React.Fragment key={item.name}>
                    {index > 0 ? (
                      <View style={[styles.divider, { backgroundColor: p.line }]} />
                    ) : null}
                    <View style={styles.foodRow}>
                      <View style={[styles.foodIcon, { backgroundColor: p['surface-300'] }]}>
                        <Feather name="coffee" size={24} color={p['brand-ink']} />
                      </View>
                      <View style={styles.foodCopy}>
                        <Text numberOfLines={1} style={[textStyles['title-md'], { color: p.ink }]}>
                          {item.name}
                        </Text>
                        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
                          {item.amount}
                        </Text>
                      </View>
                      <Text style={[textStyles.body, styles.tabular, { color: p['ink-muted'] }]}>
                        {item.calories} kcal
                      </Text>
                      <Feather name="chevron-right" size={28} color={p['ink-muted']} />
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </View>
          ))}

          <View
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            style={[styles.addFood, { borderColor: p['line-strong'] }]}
          >
            <Feather name="plus" size={28} color={p.ink} />
            <Text style={[textStyles.label, { color: p.ink }]}>Add food</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.tabBar, { backgroundColor: p['surface-200'], borderColor: p.line }]}>
        <Tab icon="home" label="Home" color={p['ink-muted']} />
        <Tab icon="activity" label="Workout" color={p['ink-muted']} />
        <View style={[styles.addTab, { backgroundColor: p.brand }]}>
          <Feather name="plus" size={36} color={p['on-brand']} />
        </View>
        <Tab icon="coffee" label="Nutrition" color={p['brand-ink']} active />
        <Tab icon="bar-chart-2" label="Progress" color={p['ink-muted']} />
      </View>
    </SafeAreaView>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function Tab({
  icon,
  label,
  color,
  active = false,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  color: string;
  active?: boolean;
}) {
  return (
    <View accessibilityState={{ selected: active }} style={styles.tab}>
      <View style={active ? styles.activeTabIcon : undefined}>
        <Feather name={icon} size={24} color={color} />
      </View>
      <Text style={[textStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: spacing['space-4'],
    paddingTop: spacing['space-8'],
    paddingBottom: spacing['space-6'],
    gap: spacing['space-6'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing['space-3'],
  },
  backButton: {
    width: sizes['tap-min'],
    height: sizes['tap-min'],
    borderRadius: radii['radius-pill'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing['space-1'] },
  dayButton: {
    flex: 1,
    minHeight: sizes['tap-min'],
    alignItems: 'center',
    gap: spacing['space-1'],
  },
  dayNumber: {
    width: 36,
    height: 36,
    borderRadius: radii['radius-pill'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayMarker: { width: 4, height: 4, borderRadius: radii['radius-pill'] },
  pressed: { opacity: 0.65 },
  summaryCard: {
    borderRadius: radii['radius-xl'],
    padding: spacing['space-4'],
    gap: spacing['space-3'],
  },
  calorieRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  calorieCopy: { gap: spacing['space-1'] },
  macro: { gap: spacing['space-2'] },
  macroLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  goalError: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTrack: { height: 16, borderRadius: radii['radius-pill'], overflow: 'hidden' },
  progressValue: { height: '100%', borderRadius: radii['radius-pill'] },
  mealGroup: { gap: spacing['space-2'] },
  mealCard: { borderRadius: radii['radius-xl'], paddingHorizontal: spacing['space-4'] },
  foodRow: { minHeight: 108, flexDirection: 'row', alignItems: 'center', gap: spacing['space-3'] },
  foodIcon: {
    width: sizes['control-height'] + spacing['space-2'],
    height: sizes['control-height'] + spacing['space-2'],
    borderRadius: radii['radius-lg'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  foodCopy: { flex: 1, gap: spacing['space-1'] },
  divider: { height: 1 },
  addFood: {
    minHeight: sizes['control-height'],
    borderWidth: 2,
    borderRadius: radii['radius-pill'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['space-3'],
  },
  tabular: { fontVariant: ['tabular-nums'] },
  tabBar: {
    minHeight: sizes['tab-bar-height'],
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingTop: spacing['space-2'],
    paddingHorizontal: spacing['space-1'],
  },
  tab: { flex: 1, alignItems: 'center', gap: spacing['space-1'], minWidth: 0 },
  activeTabIcon: {
    minWidth: sizes['control-height'],
    height: 36,
    borderRadius: radii['radius-pill'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTab: {
    width: 72,
    height: 72,
    marginTop: -spacing['space-5'],
    borderRadius: radii['radius-pill'],
    justifyContent: 'center',
    alignItems: 'center',
  },
});
