import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader, screenContentStyle } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

import { nutritionApi } from '../api';
import { AddFoodScreen } from './AddFoodScreen';

const macros = [
  { label: 'Protein', field: 'protein', color: 'macro-protein' },
  { label: 'Carbs', field: 'carbohydrates', color: 'macro-carbs' },
  { label: 'Fat', field: 'fats', color: 'macro-fat' },
] as const;

// This is the single place the future diary endpoint will populate from meal items.

const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const;

const mealTypeId = (meal: (typeof mealTypes)[number]) =>
  meal === 'Snacks' ? 'snack' : meal.toLowerCase();

const localDateId = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const mondayFor = (date: Date) => addDays(date, -((date.getDay() + 6) % 7));
const weekFor = (monday: Date) => {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    return {
      id: localDateId(date),
      weekday: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date),
      day: String(date.getDate()),
      isToday: localDateId(date) === localDateId(today),
    };
  });
};

export function NutritionDiaryScreen({
  accountId,
  onBack,
  onEditGoal,
}: Readonly<{
  accountId: number;
  onBack?: () => void;
  onEditGoal?: () => void;
}>) {
  const p = usePalette();
  const [weekStart, setWeekStart] = React.useState(() => mondayFor(new Date()));
  const week = React.useMemo(() => weekFor(weekStart), [weekStart]);
  const [selectedDay, setSelectedDay] = React.useState(() => localDateId(new Date()));
  const [selectedMeal, setSelectedMeal] = React.useState<(typeof mealTypes)[number] | null>(null);
  const [editingMeal, setEditingMeal] = React.useState<(typeof mealTypes)[number] | null>(null);
  const [draftAmounts, setDraftAmounts] = React.useState<Record<number, string>>({});
  const selected = week.find((day) => day.id === selectedDay) ?? week[0];
  const goal = useQuery({
    queryKey: ['nutrition', accountId, 'goal'],
    queryFn: ({ signal }) => nutritionApi.goal(signal),
  });
  const day = useQuery({
    queryKey: ['nutrition', accountId, 'day', selectedDay],
    queryFn: ({ signal }) => nutritionApi.day(selectedDay, signal),
  });
  const consumed = day.data ?? { calories: 0, protein: 0, carbohydrates: 0, fats: 0, items: [] };
  const removeItem = useMutation({
    mutationFn: (mealItemId: number) => nutritionApi.deleteMealItem(mealItemId),
    onSuccess: () => void day.refetch(),
  });
  const updateItem = useMutation({
    mutationFn: ({ id, value, isRecipe }: { id: number; value: number; isRecipe: boolean }) =>
      nutritionApi.updateMealItem(id, isRecipe ? { servings: value } : { quantity_grams: value }),
    onSuccess: () => void day.refetch(),
  });
  const toggleMealEditing = (meal: (typeof mealTypes)[number]) => {
    if (editingMeal === meal) {
      setEditingMeal(null);
      return;
    }
    setDraftAmounts(
      Object.fromEntries(
        consumed.items
          .filter((item) => item.meal_type === mealTypeId(meal))
          .map((item) => [
            item.id,
            String(item.recipe_id ? (item.servings ?? '') : (item.quantity_grams ?? '')),
          ]),
      ),
    );
    setEditingMeal(meal);
  };
  const changeWeek = (weeks: number) => {
    setWeekStart((current) => addDays(current, weeks * 7));
    setSelectedDay((current) => {
      const [year, month, day] = current.split('-').map(Number);
      return localDateId(addDays(new Date(year, month - 1, day), weeks * 7));
    });
    setEditingMeal(null);
    setDraftAmounts({});
  };
  const macroProgress = macros.map((macro) => {
    const goalValue = goal.data?.[macro.field];
    return {
      ...macro,
      value: consumed[macro.field],
      goalValue,
      progress:
        goalValue !== undefined && goalValue > 0
          ? Math.min((consumed[macro.field] / goalValue) * 100, 100)
          : 0,
    };
  });

  if (selectedMeal) {
    return (
      <AddFoodScreen
        accountId={accountId}
        meal={selectedMeal}
        date={selectedDay}
        onClose={() => setSelectedMeal(null)}
        onSaved={() => void day.refetch()}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p['surface-100'] }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[screenContentStyle, styles.content]}>
          <ScreenHeader
            title="Nutrition"
            leading={
              onBack ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back to home"
                  onPress={onBack}
                  style={({ pressed }) => [
                    styles.backButton,
                    { backgroundColor: p['surface-300'], opacity: pressed ? 0.55 : 1 },
                  ]}
                >
                  <Feather name="arrow-left" size={24} color={p.ink} />
                </Pressable>
              ) : undefined
            }
          >
            <Text style={[textStyles.label, { color: p['ink-muted'] }]}>
              {selected.isToday ? 'Today' : `${selected.weekday}, Oct ${selected.day}`}
            </Text>
          </ScreenHeader>

          <View
            accessibilityRole="tablist"
            accessibilityLabel="Nutrition week"
            style={styles.weekNavigation}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous week"
              onPress={() => changeWeek(-1)}
              style={({ pressed }) => [styles.weekNavButton, pressed && styles.pressed]}
            >
              <Feather name="chevron-left" size={24} color={p['ink-muted']} />
            </Pressable>
            <View style={styles.weekStrip}>
              {week.map((day) => {
                const isSelected = day.id === selectedDay;
                return (
                  <Pressable
                    key={day.id}
                    accessibilityRole="tab"
                    accessibilityLabel={`${day.weekday} October ${day.day}${day.isToday ? ', today' : ''}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      setSelectedDay(day.id);
                      setEditingMeal(null);
                      setDraftAmounts({});
                    }}
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
                    <View style={[styles.dayMarker, { backgroundColor: 'transparent' }]} />
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next week"
              onPress={() => changeWeek(1)}
              style={({ pressed }) => [styles.weekNavButton, pressed && styles.pressed]}
            >
              <Feather name="chevron-right" size={24} color={p['ink-muted']} />
            </Pressable>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: p['surface-200'] }]}>
            <View style={styles.calorieRow}>
              <View style={styles.calorieCopy}>
                <Text style={[textStyles['metric-md'], styles.tabular, { color: p.ink }]}>
                  {formatNumber(consumed.calories)} kcal
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
                    {formatNumber(macro.value)} /{' '}
                    {macro.goalValue === undefined ? '—' : formatNumber(macro.goalValue)} g
                  </Text>
                </View>
                <View
                  accessibilityLabel={`${macro.label}: ${macro.value} of ${macro.goalValue ?? 'unknown'} grams`}
                  accessibilityRole="progressbar"
                  accessibilityValue={
                    macro.goalValue === undefined || macro.goalValue === 0
                      ? undefined
                      : {
                          min: 0,
                          max: macro.goalValue,
                          now: Math.min(macro.value, macro.goalValue),
                        }
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
            {goal.data === null ? (
              <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                No nutrition target yet. You can keep recording food and set one later.
              </Text>
            ) : null}
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

          {mealTypes.map((meal) => (
            <View key={meal} style={styles.mealGroup}>
              <View style={styles.mealHeading}>
                <Text style={[textStyles.overline, { color: p['ink-muted'] }]}>
                  {meal.toUpperCase()}
                </Text>
                <View style={styles.mealHeaderActions}>
                  <Text style={[textStyles.overline, styles.tabular, { color: p['ink-muted'] }]}>
                    {formatNumber(
                      consumed.items
                        .filter((item) => item.meal_type === mealTypeId(meal))
                        .reduce((total, item) => total + item.calories, 0),
                    )}{' '}
                    KCAL
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${editingMeal === meal ? 'Finish editing' : 'Edit'} ${meal}`}
                    onPress={() => toggleMealEditing(meal)}
                  >
                    <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
                      {editingMeal === meal ? 'Done' : 'Edit'}
                    </Text>
                  </Pressable>
                </View>
              </View>
              <View style={[styles.mealCard, { backgroundColor: p['surface-200'] }]}>
                {consumed.items
                  .filter((item) => item.meal_type === mealTypeId(meal))
                  .map((item) => (
                    <View key={item.id} style={styles.loggedItem}>
                      <View style={styles.itemCopy}>
                        <Text style={[textStyles.body, { color: p.ink }]}>{item.name}</Text>
                        {editingMeal === meal ? (
                          <TextField
                            accessibilityLabel={`Edit ${item.name} quantity`}
                            keyboardType="decimal-pad"
                            value={draftAmounts[item.id] ?? ''}
                            onChangeText={(value) =>
                              setDraftAmounts((current) => ({ ...current, [item.id]: value }))
                            }
                            containerStyle={styles.quantityField}
                            inputStyle={styles.quantityInput}
                            trailing={
                              <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                                {item.recipe_id ? 'servings' : 'g'}
                              </Text>
                            }
                          />
                        ) : (
                          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                            {item.recipe_id
                              ? servingLabel(item.servings)
                              : `${item.quantity_grams} g`}
                          </Text>
                        )}
                      </View>
                      <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
                        {formatNumber(item.calories)} kcal
                      </Text>
                      {editingMeal === meal ? (
                        <View style={styles.itemEditActions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Save ${item.name} quantity`}
                            accessibilityState={{
                              disabled: updateItem.isPending || Number(draftAmounts[item.id]) <= 0,
                            }}
                            disabled={updateItem.isPending || Number(draftAmounts[item.id]) <= 0}
                            onPress={() =>
                              updateItem.mutate({
                                id: item.id,
                                value: Number(draftAmounts[item.id]),
                                isRecipe: Boolean(item.recipe_id),
                              })
                            }
                            style={styles.deleteItem}
                          >
                            <Feather name="check" size={19} color={p['brand-ink']} />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${item.name}`}
                            disabled={removeItem.isPending}
                            onPress={() => removeItem.mutate(item.id)}
                            style={styles.deleteItem}
                          >
                            <Feather name="trash-2" size={18} color={p.danger} />
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ))}
                {editingMeal === meal && updateItem.isError ? (
                  <Text
                    accessibilityRole="alert"
                    style={[textStyles['body-sm'], { color: p.danger }]}
                  >
                    We could not update this entry.
                  </Text>
                ) : null}
                {!consumed.items.some((item) => item.meal_type === mealTypeId(meal)) ? (
                  <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
                    No food logged yet
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add food to ${meal}`}
                  onPress={() => setSelectedMeal(meal)}
                  style={({ pressed }) => [
                    styles.mealAddButton,
                    { backgroundColor: p['brand-soft'], opacity: pressed ? 0.65 : 1 },
                  ]}
                >
                  <Feather name="plus" size={20} color={p['brand-ink']} />
                  <Text style={[textStyles.label, { color: p['brand-ink'] }]}>Add food</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function servingLabel(servings: number | null | undefined) {
  const unit = servings === 1 ? 'serving' : 'servings';
  return `${servings} ${unit}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: {
    paddingBottom: spacing['space-6'],
    gap: spacing['space-6'],
  },
  backButton: {
    width: sizes['tap-min'],
    height: sizes['tap-min'],
    borderRadius: radii['radius-pill'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: -spacing['space-3'],
  },
  weekNavButton: {
    width: sizes['tap-min'],
    height: sizes['tap-min'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekStrip: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
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
  mealHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mealHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-3'] },
  mealCard: {
    borderRadius: radii['radius-lg'],
    padding: spacing['space-4'],
    gap: spacing['space-3'],
  },
  loggedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing['space-2'],
  },
  deleteItem: {
    width: sizes['tap-min'],
    height: sizes['tap-min'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemEditActions: { flexDirection: 'row', alignItems: 'center' },
  quantityField: { width: 132, minHeight: sizes['control-height-sm'] },
  quantityInput: { textAlign: 'right' },
  itemCopy: { flex: 1, gap: spacing['space-1'] },
  mealAddButton: {
    minHeight: sizes['control-height-sm'],
    borderRadius: radii['radius-pill'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['space-2'],
  },
  tabular: { fontVariant: ['tabular-nums'] },
});
