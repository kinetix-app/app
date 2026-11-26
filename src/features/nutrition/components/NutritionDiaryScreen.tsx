import { getTranslation } from '@/i18n/catalog';
import { Feather } from '@expo/vector-icons';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import React from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { selectCopy, useLanguage } from '@/i18n/Language';
import { CalendarGrid } from '@/components/CalendarGrid';
import { ScreenHeader, screenContentStyle } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

import { nutritionApi } from '../api';
import { AddFoodScreen } from './AddFoodScreen';
import { NutritionSummary } from './NutritionSummary';

const macros = [
  { label: 'Protein', field: 'protein', color: 'macro-protein' },
  { label: 'Carbs', field: 'carbohydrates', color: 'macro-carbs' },
  { label: 'Fat', field: 'fats', color: 'macro-fat' },
] as const;

const targetPurpose = {
  lose_fat: 'to lose fat',
  build_muscle: 'to build muscle',
  gain_weight: 'to gain weight',
  maintain_weight: 'to maintain weight',
};

function objectivePurpose(objective: keyof typeof targetPurpose, es: boolean) {
  if (!es) return targetPurpose[objective];
  const labels = {
    lose_fat: 'para perder grasa',
    build_muscle: 'para ganar músculo',
    gain_weight: 'para ganar peso',
    maintain_weight: 'para mantener el peso',
  };
  return labels[objective];
}

function mealEditLabel(meal: (typeof mealTypes)[number], editing: boolean, es: boolean) {
  const mealEs = { Breakfast: 'desayuno', Lunch: 'comida', Dinner: 'cena', Snacks: 'tentempiés' };
  const action = editing
    ? getTranslation(es ? 'es' : 'en')('nutrition.NutritionDiaryScreen.finishEditing')
    : getTranslation(es ? 'es' : 'en')('nutrition.NutritionDiaryScreen.edit');
  return `${action} ${es ? mealEs[meal] : meal}`;
}

// This is the single place the future diary endpoint will populate from meal items.

const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const;

const mealTypeId = (meal: (typeof mealTypes)[number]) =>
  meal === 'Snacks' ? 'snack' : meal.toLowerCase();

const localDateId = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateFromId = (id: string) => {
  const [year, month, day] = id.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const mondayFor = (date: Date) => addDays(date, -((date.getDay() + 6) % 7));
const weekFor = (monday: Date, es: boolean) => {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    return {
      id: localDateId(date),
      weekday: new Intl.DateTimeFormat(selectCopy(es, 'es-ES', 'en-US'), {
        weekday: 'short',
      }).format(date),
      month: new Intl.DateTimeFormat(selectCopy(es, 'es-ES', 'en-US'), { month: 'short' }).format(
        date,
      ),
      day: String(date.getDate()),
      isToday: localDateId(date) === localDateId(today),
    };
  });
};

export function NutritionDiaryScreen({
  accountId,
  onBack,
  onEditGoal,
  onAddFoodOpenChange,
}: Readonly<{
  accountId: number;
  onBack?: () => void;
  onEditGoal?: () => void;
  onAddFoodOpenChange?: (isOpen: boolean) => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const [weekStart, setWeekStart] = React.useState(() => mondayFor(new Date()));
  const week = React.useMemo(() => weekFor(weekStart, es), [weekStart, es]);
  const [selectedDay, setSelectedDay] = React.useState(() => localDateId(new Date()));
  const [selectedMeal, setSelectedMeal] = React.useState<(typeof mealTypes)[number] | null>(null);
  const [editingMeal, setEditingMeal] = React.useState<(typeof mealTypes)[number] | null>(null);
  const [draftAmounts, setDraftAmounts] = React.useState<Record<number, string>>({});
  const [calendarVisible, setCalendarVisible] = React.useState(false);
  const [calendarMonth, setCalendarMonth] = React.useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [weekTranslate] = React.useState(() => new Animated.Value(0));
  const [isWeekAnimating, setIsWeekAnimating] = React.useState(false);
  const selected = week.find((day) => day.id === selectedDay) ?? week[0];
  const goal = useQuery({
    queryKey: ['nutrition', accountId, 'goal'],
    queryFn: ({ signal }) => nutritionApi.goal(signal),
  });
  const day = useQuery({
    queryKey: ['nutrition', accountId, 'day', selectedDay],
    queryFn: ({ signal }) => nutritionApi.day(selectedDay, signal),
    placeholderData: keepPreviousData,
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
    if (isWeekAnimating) return;
    setIsWeekAnimating(true);
    Animated.timing(weekTranslate, {
      toValue: weeks > 0 ? -32 : 32,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      setWeekStart((current) => addDays(current, weeks * 7));
      setSelectedDay((current) => {
        const [year, month, day] = current.split('-').map(Number);
        return localDateId(addDays(new Date(year, month - 1, day), weeks * 7));
      });
      setEditingMeal(null);
      setDraftAmounts({});
      weekTranslate.setValue(weeks > 0 ? 32 : -32);
      Animated.timing(weekTranslate, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => setIsWeekAnimating(false));
    });
  };
  const openCalendar = () => {
    const selectedDate = dateFromId(selectedDay);
    setCalendarMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    setCalendarVisible(true);
  };
  const selectCalendarDay = (date: Date) => {
    setSelectedDay(localDateId(date));
    setWeekStart(mondayFor(date));
    setEditingMeal(null);
    setDraftAmounts({});
    setCalendarVisible(false);
  };
  const macroProgress = macros.map((macro) => {
    const goalValue = goal.data?.[macro.field];
    return {
      ...macro,
      label: es
        ? { protein: 'Proteínas', carbohydrates: 'Carbohidratos', fats: 'Grasas' }[macro.field]
        : macro.label,
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
        onClose={() => {
          setSelectedMeal(null);
          onAddFoodOpenChange?.(false);
        }}
        onSaved={() => void day.refetch()}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p['surface-100'] }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[screenContentStyle, styles.content]}>
          <ScreenHeader
            title={getTranslation(es ? 'es' : 'en')('nutrition.NutritionDiaryScreen.nutrition')}
            leading={
              onBack ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                    'nutrition.NutritionDiaryScreen.backToFeed',
                  )}
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                'nutrition.NutritionDiaryScreen.openCalendar',
              )}
              onPress={openCalendar}
              style={styles.dateButton}
            >
              <Text style={[textStyles.label, { color: p['ink-muted'] }]}>
                {selected.isToday
                  ? getTranslation(es ? 'es' : 'en')('nutrition.NutritionDiaryScreen.today')
                  : `${selected.weekday}, ${selected.month} ${selected.day}, ${dateFromId(selectedDay).getFullYear()}`}
              </Text>
              <Feather name="calendar" size={18} color={p['ink-muted']} />
            </Pressable>
          </ScreenHeader>

          <View
            accessibilityRole="tablist"
            accessibilityLabel={getTranslation(es ? 'es' : 'en')(
              'nutrition.NutritionDiaryScreen.nutritionWeek',
            )}
            style={styles.weekNavigation}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                'nutrition.NutritionDiaryScreen.previousWeek',
              )}
              accessibilityState={{ disabled: isWeekAnimating }}
              disabled={isWeekAnimating}
              onPress={() => changeWeek(-1)}
              style={({ pressed }) => [styles.weekNavButton, pressed && styles.pressed]}
            >
              <Feather name="chevron-left" size={24} color={p['ink-muted']} />
            </Pressable>
            <Animated.View style={styles.weekStrip}>
              <View style={styles.weekdayRow}>
                {week.map((day) => {
                  const isSelected = day.id === selectedDay;
                  return (
                    <Text
                      key={day.weekday}
                      style={[
                        textStyles.caption,
                        { color: isSelected ? p['brand-ink'] : p['ink-muted'] },
                      ]}
                    >
                      {day.weekday}
                    </Text>
                  );
                })}
              </View>
              <Animated.View
                style={[styles.weekNumberRow, { transform: [{ translateX: weekTranslate }] }]}
              >
                {week.map((day) => {
                  const isSelected = day.id === selectedDay;
                  return (
                    <Pressable
                      key={day.id}
                      accessibilityRole="tab"
                      accessibilityLabel={`${day.weekday} ${day.month} ${day.day}${day.isToday ? getTranslation(es ? 'es' : 'en')('nutrition.NutritionDiaryScreen.today2') : ''}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        setSelectedDay(day.id);
                        setEditingMeal(null);
                        setDraftAmounts({});
                      }}
                      style={({ pressed }) => [styles.dayButton, pressed && styles.pressed]}
                    >
                      <View
                        style={[
                          styles.dayNumber,
                          isSelected && { borderColor: p.brand, borderWidth: 2 },
                          day.isToday &&
                            !isSelected && { borderColor: `${p.brand}66`, borderWidth: 2 },
                        ]}
                      >
                        <Text
                          style={[
                            textStyles.label,
                            { color: isSelected || day.isToday ? p['brand-ink'] : p.ink },
                          ]}
                        >
                          {day.day}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </Animated.View>
            </Animated.View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                'nutrition.NutritionDiaryScreen.nextWeek',
              )}
              accessibilityState={{ disabled: isWeekAnimating }}
              disabled={isWeekAnimating}
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
                  {getTranslation(es ? 'es' : 'en')('nutrition.NutritionDiaryScreen.of')}{' '}
                  {goal.data ? formatNumber(goal.data.calories) : '—'} kcal
                  {goal.data?.objective ? ` ${objectivePurpose(goal.data.objective, es)}` : ''}
                </Text>
              </View>
              {onEditGoal ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                    'nutrition.NutritionDiaryScreen.editNutritionGoal',
                  )}
                  onPress={onEditGoal}
                >
                  <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
                    {getTranslation(es ? 'es' : 'en')('nutrition.NutritionDiaryScreen.editGoal')}
                  </Text>
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
                  accessibilityLabel={
                    es
                      ? `${macro.label}: ${macro.value} de ${macro.goalValue ?? 'desconocido'} gramos`
                      : `${macro.label}: ${macro.value} of ${macro.goalValue ?? 'unknown'} grams`
                  }
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
                {getTranslation(es ? 'es' : 'en')(
                  'nutrition.NutritionDiaryScreen.noNutritionTargetYetYouCanKeepRecordingFoodAndSetOneLater',
                )}
              </Text>
            ) : null}
            {goal.isError ? (
              <View style={styles.goalError}>
                <Text
                  accessibilityRole="alert"
                  style={[textStyles['body-sm'], { color: p.danger }]}
                >
                  {getTranslation(es ? 'es' : 'en')(
                    'nutrition.NutritionDiaryScreen.weCouldNotLoadYourNutritionGoal',
                  )}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                    'nutrition.NutritionDiaryScreen.retryLoadingNutritionGoal',
                  )}
                  onPress={() => void goal.refetch()}
                >
                  <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
                    {getTranslation(es ? 'es' : 'en')('nutrition.NutritionDiaryScreen.retry')}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {mealTypes.map((meal) => (
            <View key={meal} style={styles.mealGroup}>
              <View style={styles.mealHeading}>
                <Text style={[textStyles.overline, { color: p['ink-muted'] }]}>
                  {(es
                    ? {
                        Breakfast: 'Desayuno',
                        Lunch: 'Comida',
                        Dinner: 'Cena',
                        Snacks: 'Tentempiés',
                      }[meal]
                    : meal
                  ).toUpperCase()}
                </Text>
                <View style={styles.mealHeaderActions}>
                  {consumed.items.some((item) => item.meal_type === mealTypeId(meal)) ? (
                    <NutritionSummary
                      values={consumed.items
                        .filter((item) => item.meal_type === mealTypeId(meal))
                        .reduce(
                          (total, item) => ({
                            calories: total.calories + item.calories,
                            carbohydrates: total.carbohydrates + item.carbohydrates,
                            protein: total.protein + item.protein,
                            fats: total.fats + item.fats,
                          }),
                          { calories: 0, carbohydrates: 0, protein: 0, fats: 0 },
                        )}
                    />
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={mealEditLabel(meal, editingMeal === meal, es)}
                    onPress={() => toggleMealEditing(meal)}
                  >
                    <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
                      {editingMeal === meal
                        ? getTranslation(es ? 'es' : 'en')('nutrition.NutritionDiaryScreen.done')
                        : getTranslation(es ? 'es' : 'en')('nutrition.NutritionDiaryScreen.edit')}
                    </Text>
                  </Pressable>
                </View>
              </View>
              <View style={[styles.mealCard, { backgroundColor: p['surface-200'] }]}>
                <View style={styles.mealCardContent}>
                  {consumed.items
                    .filter((item) => item.meal_type === mealTypeId(meal))
                    .map((item) => (
                      <View key={item.id} style={styles.loggedItem}>
                        {editingMeal === meal ? (
                          <>
                            <Text style={[textStyles.body, { color: p.ink }]}>{item.name}</Text>
                            <View style={styles.itemLine}>
                              <TextField
                                accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                                  'dynamicMessages.editQuantity_a400d2',
                                  { value1: item.name },
                                )}
                                keyboardType="decimal-pad"
                                value={draftAmounts[item.id] ?? ''}
                                onChangeText={(value) =>
                                  setDraftAmounts((current) => ({ ...current, [item.id]: value }))
                                }
                                containerStyle={styles.quantityField}
                                inputStyle={styles.quantityInput}
                                trailing={
                                  <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                                    {item.recipe_id
                                      ? getTranslation(es ? 'es' : 'en')(
                                          'nutrition.NutritionDiaryScreen.servings',
                                        )
                                      : 'g'}
                                  </Text>
                                }
                              />
                              <Text
                                style={[
                                  textStyles['body-sm'],
                                  styles.itemCalories,
                                  styles.tabular,
                                  { color: p['ink-muted'] },
                                ]}
                              >
                                {formatNumber(item.calories)} kcal
                              </Text>
                              <View style={styles.itemEditActions}>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                                    'dynamicMessages.saveQuantity_7bdad5',
                                    { value1: item.name },
                                  )}
                                  accessibilityState={{
                                    disabled:
                                      updateItem.isPending || Number(draftAmounts[item.id]) <= 0,
                                  }}
                                  disabled={
                                    updateItem.isPending || Number(draftAmounts[item.id]) <= 0
                                  }
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
                                  accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                                    'dynamicMessages.delete_602940',
                                    { value1: item.name },
                                  )}
                                  disabled={removeItem.isPending}
                                  onPress={() => removeItem.mutate(item.id)}
                                  style={styles.deleteItem}
                                >
                                  <Feather name="trash-2" size={18} color={p.danger} />
                                </Pressable>
                              </View>
                            </View>
                          </>
                        ) : (
                          <View style={styles.itemLine}>
                            <View style={styles.itemCopy}>
                              <Text style={[textStyles.body, { color: p.ink }]}>{item.name}</Text>
                              <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                                {item.recipe_id
                                  ? servingLabel(item.servings, es)
                                  : `${item.quantity_grams} g`}
                              </Text>
                            </View>
                            <Text
                              style={[textStyles.body, styles.tabular, { color: p['ink-muted'] }]}
                            >
                              {formatNumber(item.calories)} kcal
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  {editingMeal === meal && updateItem.isError ? (
                    <Text
                      accessibilityRole="alert"
                      style={[textStyles['body-sm'], { color: p.danger }]}
                    >
                      {getTranslation(es ? 'es' : 'en')(
                        'nutrition.NutritionDiaryScreen.weCouldNotUpdateThisEntry',
                      )}
                    </Text>
                  ) : null}
                  {!consumed.items.some((item) => item.meal_type === mealTypeId(meal)) ? (
                    <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
                      {getTranslation(es ? 'es' : 'en')(
                        'nutrition.NutritionDiaryScreen.noFoodLoggedYet',
                      )}
                    </Text>
                  ) : null}
                </View>
                {editingMeal !== meal ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      es
                        ? `Añadir alimentos a ${{ Breakfast: 'desayuno', Lunch: 'comida', Dinner: 'cena', Snacks: 'tentempiés' }[meal]}`
                        : `Add food to ${meal}`
                    }
                    onPress={() => {
                      setSelectedMeal(meal);
                      onAddFoodOpenChange?.(true);
                    }}
                    style={({ pressed }) => [
                      styles.mealAddButton,
                      { backgroundColor: p['brand-soft'], opacity: pressed ? 0.65 : 1 },
                    ]}
                  >
                    <Feather name="plus" size={20} color={p['brand-ink']} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <CalendarModal
        visible={calendarVisible}
        month={calendarMonth}
        selectedDay={selectedDay}
        onChangeMonth={setCalendarMonth}
        onSelect={selectCalendarDay}
        onClose={() => setCalendarVisible(false)}
      />
    </SafeAreaView>
  );
}

function CalendarModal({
  visible,
  month,
  selectedDay,
  onChangeMonth,
  onSelect,
  onClose,
}: Readonly<{
  visible: boolean;
  month: Date;
  selectedDay: string;
  onChangeMonth: (month: Date) => void;
  onSelect: (date: Date) => void;
  onClose: () => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const monthLabel = new Intl.DateTimeFormat(selectCopy(es, 'es-ES', 'en-US'), {
    month: 'long',
    year: 'numeric',
  }).format(month);
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={[styles.calendarBackdrop, { backgroundColor: p.scrim }]}>
        <View
          accessibilityViewIsModal
          style={[styles.calendarCard, { backgroundColor: p['surface-200'] }]}
        >
          <View style={styles.calendarHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                'nutrition.NutritionDiaryScreen.previousMonth',
              )}
              onPress={() => onChangeMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              style={styles.calendarArrow}
            >
              <Feather name="chevron-left" size={22} color={p.ink} />
            </Pressable>
            <Text style={[textStyles['title-md'], { color: p.ink }]}>{monthLabel}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                'nutrition.NutritionDiaryScreen.nextMonth',
              )}
              onPress={() => onChangeMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              style={styles.calendarArrow}
            >
              <Feather name="chevron-right" size={22} color={p.ink} />
            </Pressable>
          </View>
          <CalendarGrid
            month={localDateId(month)}
            today={localDateId(new Date())}
            selected={selectedDay}
            onSelect={(day) => onSelect(dateFromId(day))}
          />
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.calendarClose, { backgroundColor: p['surface-300'] }]}
          >
            <Text style={[textStyles.label, { color: p.ink }]}>
              {getTranslation(es ? 'es' : 'en')('nutrition.NutritionDiaryScreen.cancel')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function servingLabel(servings: number | null | undefined, es: boolean) {
  const unit =
    servings === 1
      ? getTranslation(es ? 'es' : 'en')('nutrition.NutritionDiaryScreen.serving')
      : getTranslation(es ? 'es' : 'en')('nutrition.NutritionDiaryScreen.servings');
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
    alignItems: 'flex-end',
    marginHorizontal: -spacing['space-3'],
  },
  weekNavButton: {
    width: sizes['tap-min'],
    height: sizes['tap-min'],
    marginBottom: spacing['space-1'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekStrip: { flex: 1, gap: spacing['space-1'] },
  weekdayRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekNumberRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayButton: {
    flex: 1,
    height: sizes['tap-min'],
    alignItems: 'center',
  },
  dayNumber: {
    width: 36,
    height: 36,
    borderRadius: radii['radius-pill'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: { opacity: 0.65 },
  summaryCard: {
    borderRadius: radii['radius-xl'],
    padding: spacing['space-4'],
    gap: spacing['space-3'],
  },
  calorieRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  calorieCopy: { gap: spacing['space-1'] },
  dateButton: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-2'] },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-3'],
  },
  mealCardContent: { flex: 1, gap: spacing['space-3'] },
  loggedItem: { gap: spacing['space-1'] },
  itemLine: {
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
  quantityField: { width: 116, minHeight: sizes['control-height-sm'] },
  itemCalories: { flex: 1, textAlign: 'right' },
  quantityInput: {
    minHeight: sizes['control-height-sm'] - 2,
    paddingVertical: 0,
    textAlign: 'right',
  },
  itemCopy: { flex: 1, gap: spacing['space-1'] },
  mealAddButton: {
    width: sizes['tap-min'],
    height: sizes['tap-min'],
    borderRadius: radii['radius-pill'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabular: { fontVariant: ['tabular-nums'] },
  calendarBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['space-4'],
  },
  calendarCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radii['radius-xl'],
    padding: spacing['space-4'],
    gap: spacing['space-3'],
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarArrow: {
    width: sizes['tap-min'],
    height: sizes['tap-min'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarClose: {
    minHeight: sizes['control-height-sm'],
    borderRadius: radii['radius-pill'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
