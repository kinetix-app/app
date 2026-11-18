import { Feather } from '@expo/vector-icons';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TextField } from '@/components/TextField';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { nutritionApi } from '../api';
import type { Food, Recipe } from '../schemas';

type QueuedFood = { food: Food; quantityGrams: number };

const mealTypeFor = (meal: string) =>
  ({ Breakfast: 'breakfast', Lunch: 'lunch', Dinner: 'dinner', Snacks: 'snack' })[meal] as
    'breakfast' | 'lunch' | 'dinner' | 'snack';

export function AddFoodScreen({
  accountId,
  meal,
  date,
  onClose,
  onSaved,
}: Readonly<{
  accountId: number;
  meal: string;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}>) {
  const p = usePalette();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [tab, setTab] = React.useState<'Food' | 'Recipe'>('Food');
  const [showFoodEditor, setShowFoodEditor] = React.useState(false);
  const [showRecipeEditor, setShowRecipeEditor] = React.useState(false);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Food | null>(null);
  const [foodToDelete, setFoodToDelete] = React.useState<Food | null>(null);
  const [editingFood, setEditingFood] = React.useState<Food | null>(null);
  const [editingRecipe, setEditingRecipe] = React.useState<Recipe | null>(null);
  const [amount, setAmount] = React.useState('');
  const [previewAmount, setPreviewAmount] = React.useState('');
  const [queuedFoods, setQueuedFoods] = React.useState<QueuedFood[]>([]);
  const [reviewingFoods, setReviewingFoods] = React.useState(false);
  const toggleFoodSelection = (food: Food) => {
    setSelected((current) => (current?.id === food.id ? null : food));
    setAmount('');
    setPreviewAmount('');
  };
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  React.useEffect(() => {
    const timer = setTimeout(() => setPreviewAmount(amount), 250);
    return () => clearTimeout(timer);
  }, [amount]);
  const results = useQuery({
    queryKey: ['nutrition', 'foods', debouncedSearch],
    queryFn: ({ signal }) =>
      debouncedSearch
        ? nutritionApi.searchFoods(debouncedSearch, signal)
        : nutritionApi.foods(signal),
    placeholderData: keepPreviousData,
  });
  const saveQueue = useMutation({
    mutationFn: async () => {
      const queue = queuedFoods;
      const results = await Promise.allSettled(
        queue.map((item) =>
          nutritionApi.addMealItem({
            date,
            meal_type: mealTypeFor(meal),
            food_id: item.food.id,
            quantity_grams: item.quantityGrams,
          }),
        ),
      );
      const savedIds = new Set(
        queue
          .filter((_, index) => results[index].status === 'fulfilled')
          .map((item) => item.food.id),
      );
      if (savedIds.size) {
        setQueuedFoods((current) => current.filter((item) => !savedIds.has(item.food.id)));
        onSaved();
      }
      if (results.some((result) => result.status === 'rejected')) {
        throw new Error('Some foods could not be added.');
      }
    },
    onSuccess: onClose,
  });
  const queueSelectedFood = () => {
    if (!selected || Number(amount) <= 0) return;
    const queued = {
      food: selected,
      quantityGrams: Math.round(Number(amount) * 100) / 100,
    };
    setQueuedFoods((current) => {
      const existing = current.findIndex((item) => item.food.id === selected.id);
      if (existing < 0) return [...current, queued];
      return current.map((item, index) => (index === existing ? queued : item));
    });
    setSelected(null);
    setAmount('');
    setPreviewAmount('');
  };
  const removeFood = useMutation({
    mutationFn: (foodId: number) => nutritionApi.deleteFood(foodId),
    onSuccess: (_, foodId) => {
      if (selected?.id === foodId) setSelected(null);
      setFoodToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['nutrition', 'foods'] });
    },
  });
  const foodTab = tab === 'Food';
  const showingFoodPicker = foodTab && !showFoodEditor && !reviewingFoods;
  const editingFoodOnTab = foodTab && showFoodEditor && !reviewingFoods;
  const reviewingFoodOnTab = foodTab && reviewingFoods;
  const editingRecipeOnTab = tab === 'Recipe' && showRecipeEditor;
  const showingReviewButton = showingFoodPicker && queuedFoods.length > 0;
  function renderReviewButton() {
    return showingReviewButton ? (
      <View style={[styles.reviewFooter, { backgroundColor: p['surface-100'] }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setReviewingFoods(true)}
          style={[styles.add, { marginTop: 0, backgroundColor: p.brand }]}
        >
          <Text style={[textStyles.label, { color: p['on-brand'] }]}>
            Review {queuedFoods.length} {queuedFoods.length === 1 ? 'food' : 'foods'}
          </Text>
        </Pressable>
      </View>
    ) : null;
  }
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p['surface-100'] }]}>
      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        scrollEnabled={!showingFoodPicker}
        contentContainerStyle={[styles.content, showingFoodPicker && styles.foodPickerContent]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={reviewingFoods ? 'Back to add food' : 'Back to nutrition'}
            onPress={() => {
              if (reviewingFoods) {
                saveQueue.reset();
                setReviewingFoods(false);
                return;
              }
              onClose();
            }}
            style={[styles.back, { backgroundColor: p['surface-300'] }]}
          >
            <Feather name="arrow-left" size={24} color={p.ink} />
          </Pressable>
          <View>
            <Text accessibilityRole="header" style={[textStyles['title-lg'], { color: p.ink }]}>
              Add food
            </Text>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{meal}</Text>
          </View>
        </View>
        <View style={styles.chips}>
          {(['Food', 'Recipe'] as const).map((label) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: tab === label }}
              onPress={() => setTab(label)}
              key={label}
              style={[
                styles.chip,
                { backgroundColor: tab === label ? p['brand-soft'] : p['surface-300'] },
              ]}
            >
              <Text style={[textStyles.label, { color: tab === label ? p['brand-ink'] : p.ink }]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {editingFoodOnTab ? (
          <FoodEditor
            key={editingFood?.id ?? 'new-food'}
            food={editingFood}
            onSaved={() => {
              setShowFoodEditor(false);
              setEditingFood(null);
              setSelected(null);
            }}
          />
        ) : null}
        {showingFoodPicker ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEditingFood(null);
                setShowFoodEditor(true);
              }}
              style={[styles.newRecipe, { borderColor: p['brand-ink'] }]}
            >
              <Feather name="plus" size={20} color={p['brand-ink']} />
              <Text style={[textStyles.label, { color: p['brand-ink'] }]}>New food</Text>
            </Pressable>
            <Text style={[textStyles.label, { color: p.ink }]}>Search</Text>
            <TextField
              accessibilityLabel="Search food"
              leading={<Feather name="search" size={20} color={p['ink-muted']} />}
              value={search}
              onChangeText={setSearch}
              placeholder="Chicken, rice, yogurt…"
            />
          </>
        ) : null}
        {editingRecipeOnTab ? (
          <RecipeEditor
            key={editingRecipe?.id ?? 'new-recipe'}
            recipe={editingRecipe}
            onSaved={() => {
              setShowRecipeEditor(false);
              setEditingRecipe(null);
            }}
          />
        ) : null}
        {!showRecipeEditor ? (
          <View style={tab === 'Recipe' ? undefined : styles.hidden}>
            <RecipePicker
              meal={meal}
              date={date}
              onNewRecipe={() => {
                setEditingRecipe(null);
                setShowRecipeEditor(true);
              }}
              onEdit={(recipe) => {
                setEditingRecipe(recipe);
                setShowRecipeEditor(true);
              }}
              onSaved={onSaved}
              onClose={onClose}
              accountId={accountId}
            />
          </View>
        ) : null}
        {reviewingFoodOnTab ? (
          <FoodQueueReview
            meal={meal}
            foods={queuedFoods}
            pending={saveQueue.isPending}
            error={saveQueue.isError}
            onBack={() => {
              saveQueue.reset();
              setReviewingFoods(false);
            }}
            onRemove={(foodId) => {
              const remaining = queuedFoods.filter((item) => item.food.id !== foodId);
              setQueuedFoods(remaining);
              if (!remaining.length) setReviewingFoods(false);
            }}
            onUpdateQuantity={(foodId, quantityGrams) =>
              setQueuedFoods((current) =>
                current.map((item) =>
                  item.food.id === foodId ? { ...item, quantityGrams } : item,
                ),
              )
            }
            onConfirm={() => saveQueue.mutate()}
          />
        ) : null}
        {showingFoodPicker ? (
          <ScrollView
            style={styles.foodListScroll}
            contentContainerStyle={styles.foodListContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <FoodContent
              foods={results.data ?? []}
              isPending={results.isPending}
              search={debouncedSearch}
              selected={selected}
              queuedFoodIds={queuedFoods.map((item) => item.food.id)}
              onSelect={toggleFoodSelection}
              accountId={accountId}
              onEdit={(food) => {
                setEditingFood(food);
                setShowFoodEditor(true);
              }}
              foodToDelete={foodToDelete}
              onRequestDelete={(food) => {
                removeFood.reset();
                setFoodToDelete(food);
              }}
              onCancelDelete={() => setFoodToDelete(null)}
              removeFoodError={removeFood.isError}
              removeFoodPending={removeFood.isPending}
              onConfirmDelete={() => {
                if (foodToDelete) removeFood.mutate(foodToDelete.id);
              }}
              amount={amount}
              previewAmount={previewAmount}
              onAmountChange={setAmount}
              onQueue={queueSelectedFood}
            />
          </ScrollView>
        ) : null}
      </ScrollView>
      {renderReviewButton()}
    </SafeAreaView>
  );
}

function FoodContent({
  foods,
  isPending,
  search,
  selected,
  queuedFoodIds,
  onSelect,
  accountId,
  onEdit,
  foodToDelete,
  onRequestDelete,
  onCancelDelete,
  removeFoodError,
  removeFoodPending,
  onConfirmDelete,
  amount,
  previewAmount,
  onAmountChange,
  onQueue,
}: Readonly<{
  foods: Food[];
  isPending: boolean;
  search: string;
  selected: Food | null;
  queuedFoodIds: number[];
  onSelect: (food: Food) => void;
  accountId: number;
  onEdit: (food: Food) => void;
  foodToDelete: Food | null;
  onRequestDelete: (food: Food) => void;
  onCancelDelete: () => void;
  removeFoodError: boolean;
  removeFoodPending: boolean;
  onConfirmDelete: () => void;
  amount: string;
  previewAmount: string;
  onAmountChange: (amount: string) => void;
  onQueue: () => void;
}>) {
  return (
    <>
      <FoodResults
        foods={foods}
        isPending={isPending}
        search={search}
        selected={selected}
        queuedFoodIds={queuedFoodIds}
        onSelect={onSelect}
        accountId={accountId}
        onEdit={onEdit}
        onRequestDelete={onRequestDelete}
      />
      <DeleteFoodConfirmation
        food={foodToDelete}
        error={removeFoodError}
        pending={removeFoodPending}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
      {selected ? (
        <>
          <SelectedFoodPreview food={selected} amount={previewAmount} />
          <FoodAmount
            selected={selected}
            amount={amount}
            onAmountChange={onAmountChange}
            onQueue={onQueue}
          />
        </>
      ) : null}
    </>
  );
}

function FoodResults({
  foods,
  isPending,
  search,
  selected,
  queuedFoodIds,
  onSelect,
  accountId,
  onEdit,
  onRequestDelete,
}: Readonly<{
  foods: Food[];
  isPending: boolean;
  search: string;
  selected: Food | null;
  queuedFoodIds: number[];
  onSelect: (food: Food) => void;
  accountId: number;
  onEdit: (food: Food) => void;
  onRequestDelete: (food: Food) => void;
}>) {
  const p = usePalette();
  const selectedIndex = selected ? foods.findIndex((food) => food.id === selected.id) : -1;
  const visibleFoods = selectedIndex >= 0 ? foods.slice(0, selectedIndex + 1) : foods;
  return (
    <View style={[styles.results, { backgroundColor: p['surface-200'] }]}>
      {visibleFoods.map((food) => {
        const isQueued = queuedFoodIds.includes(food.id);
        const isSelected = selected?.id === food.id || isQueued;
        return (
          <View key={food.name} style={styles.recipeRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Select ${food.name}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelect(food)}
              style={({ pressed }) => [styles.recipeSelect, { opacity: pressed ? 0.65 : 1 }]}
            >
              <View
                style={[
                  styles.foodIcon,
                  {
                    backgroundColor: p['surface-300'],
                    borderColor: isSelected ? p['brand-ink'] : 'transparent',
                    borderWidth: 2,
                  },
                ]}
              >
                <Feather name="coffee" size={22} color={p['brand-ink']} />
              </View>
              <View style={styles.flex}>
                <Text style={[textStyles.body, { color: p.ink }]}>{food.name}</Text>
                <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                  Per 100 g · {food.calories} kcal
                </Text>
              </View>
            </Pressable>
            {food.user_id === accountId ? (
              <View style={styles.itemActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${food.name}`}
                  hitSlop={spacing['space-1']}
                  onPress={() => onEdit(food)}
                  style={styles.editItem}
                >
                  <Feather name="edit-2" size={19} color={p['brand-ink']} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${food.name}`}
                  onPress={() => onRequestDelete(food)}
                  hitSlop={spacing['space-1']}
                  style={styles.deleteRecipe}
                >
                  <Feather name="trash-2" size={20} color={p.danger} />
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
      {search && !isPending && !foods.length ? (
        <Text style={[textStyles.body, { color: p['ink-muted'] }]}>No foods found.</Text>
      ) : null}
    </View>
  );
}

function DeleteFoodConfirmation({
  food,
  error,
  pending,
  onCancel,
  onConfirm,
}: Readonly<{
  food: Food | null;
  error: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}>) {
  const p = usePalette();
  return (
    <Modal transparent animationType="fade" visible={Boolean(food)} onRequestClose={onCancel}>
      <View style={[styles.modalBackdrop, { backgroundColor: p.scrim }]}>
        <View
          accessibilityViewIsModal
          style={[styles.deleteConfirmation, { backgroundColor: p['surface-200'] }]}
        >
          <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
            {error ? 'Can’t delete food' : 'Delete food?'}
          </Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            {error
              ? `“${food?.name}” is used in a recipe or diary and must be kept.`
              : `Delete “${food?.name}”? This cannot be undone.`}
          </Text>
          <View style={styles.confirmationActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={[styles.confirmButton, { backgroundColor: p['surface-300'] }]}
            >
              <Text style={[textStyles.label, { color: p.ink }]}>{error ? 'Close' : 'Cancel'}</Text>
            </Pressable>
            {!error ? (
              <Pressable
                accessibilityRole="button"
                disabled={pending}
                onPress={onConfirm}
                style={[styles.confirmButton, { backgroundColor: p.danger }]}
              >
                <Text style={[textStyles.label, { color: p['on-brand'] }]}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FoodQueueReview({
  meal,
  foods,
  pending,
  error,
  onBack,
  onRemove,
  onUpdateQuantity,
  onConfirm,
}: Readonly<{
  meal: string;
  foods: QueuedFood[];
  pending: boolean;
  error: boolean;
  onBack: () => void;
  onRemove: (foodId: number) => void;
  onUpdateQuantity: (foodId: number, quantityGrams: number) => void;
  onConfirm: () => void;
}>) {
  const p = usePalette();
  const [editingFood, setEditingFood] = React.useState<QueuedFood | null>(null);
  const [draftQuantity, setDraftQuantity] = React.useState('');
  const totals = foods.reduce(
    (current, item) => {
      const multiplier = item.quantityGrams / 100;
      return {
        calories: current.calories + item.food.calories * multiplier,
        protein: current.protein + item.food.protein * multiplier,
        carbohydrates: current.carbohydrates + item.food.carbohydrates * multiplier,
        fats: current.fats + item.food.fats * multiplier,
      };
    },
    { calories: 0, protein: 0, carbohydrates: 0, fats: 0 },
  );
  const summary = [
    ['C', totals.carbohydrates],
    ['P', totals.protein],
    ['F', totals.fats],
  ] as const;
  const editingIndex = editingFood
    ? foods.findIndex((item) => item.food.id === editingFood.food.id)
    : -1;
  const visibleFoods = editingIndex >= 0 ? foods.slice(0, editingIndex + 1) : foods;
  const foodNoun = foods.length === 1 ? 'food' : 'foods';
  const addLabel = `Add ${foods.length} ${foodNoun} to ${meal}`;
  return (
    <View style={styles.recipeForm}>
      <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
        Review foods
      </Text>
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        Check your selection before adding it to {meal}.
      </Text>
      <View style={[styles.results, { backgroundColor: p['surface-200'] }]}>
        {visibleFoods.map((item) => {
          return (
            <View key={item.food.id} style={styles.queueRow}>
              <View style={styles.flex}>
                <Text style={[textStyles.body, { color: p.ink }]}>{item.food.name}</Text>
                <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                  {item.quantityGrams} g ·{' '}
                  {Math.round((item.food.calories * item.quantityGrams) / 100)} kcal
                </Text>
              </View>
              <View style={styles.itemActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.food.name} quantity`}
                  disabled={pending}
                  onPress={() => {
                    if (editingFood?.food.id === item.food.id) {
                      setEditingFood(null);
                      setDraftQuantity('');
                      return;
                    }
                    setEditingFood(item);
                    setDraftQuantity(String(item.quantityGrams));
                  }}
                  style={styles.editItem}
                >
                  <Feather name="edit-2" size={19} color={p['brand-ink']} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.food.name} from selection`}
                  disabled={pending}
                  onPress={() => {
                    if (editingFood?.food.id === item.food.id) {
                      setEditingFood(null);
                      setDraftQuantity('');
                    }
                    onRemove(item.food.id);
                  }}
                  style={styles.deleteRecipe}
                >
                  <Feather name="trash-2" size={20} color={p.danger} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
      {editingFood ? (
        <>
          <SelectedFoodPreview food={editingFood.food} amount={draftQuantity} />
          <FoodAmount
            selected={editingFood.food}
            amount={draftQuantity}
            onAmountChange={setDraftQuantity}
            actionLabel="Save changes"
            onQueue={() => {
              if (Number(draftQuantity) <= 0) return;
              onUpdateQuantity(editingFood.food.id, Math.round(Number(draftQuantity) * 100) / 100);
              setEditingFood(null);
              setDraftQuantity('');
            }}
          />
        </>
      ) : null}
      <View
        accessible
        accessibilityLabel={`Nutrition summary: ${Math.round(totals.calories)} calories, ${formatGrams(totals.carbohydrates)} grams carbohydrates, ${formatGrams(totals.protein)} grams protein, ${formatGrams(totals.fats)} grams fat`}
        style={[styles.preview, { backgroundColor: p['brand-soft'] }]}
      >
        <View style={styles.reviewSummary}>
          <Text style={[textStyles.overline, styles.tabular, { color: p['ink-muted'] }]}>
            {Math.round(totals.calories)} KCAL
          </Text>
          {summary.map(([label, value]) => (
            <View key={label} style={styles.reviewMacro}>
              <Text style={[textStyles.overline, { color: p.ink }]}>{label}</Text>
              <Text style={[textStyles.overline, styles.tabular, { color: p['ink-muted'] }]}>
                {formatGrams(value)}g
              </Text>
            </View>
          ))}
        </View>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
          Some foods could not be added. Review the remaining selection and try again.
        </Text>
      ) : null}
      <View style={styles.confirmationActions}>
        <Pressable
          accessibilityRole="button"
          disabled={pending}
          onPress={onBack}
          style={[styles.confirmButton, { backgroundColor: p['surface-300'] }]}
        >
          <Text style={[textStyles.label, { color: p.ink }]}>Back</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: pending || !foods.length }}
          disabled={pending || !foods.length}
          onPress={onConfirm}
          style={[
            styles.confirmButton,
            { backgroundColor: p.brand, opacity: pending || !foods.length ? 0.55 : 1 },
          ]}
        >
          <Text style={[textStyles.label, { color: p['on-brand'] }]}>
            {pending ? 'Adding…' : addLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function FoodAmount({
  selected,
  amount,
  onAmountChange,
  onQueue,
  actionLabel = 'Add food',
}: Readonly<{
  selected: Food | null;
  amount: string;
  onAmountChange: (amount: string) => void;
  onQueue: () => void;
  actionLabel?: string;
}>) {
  const p = usePalette();
  const total =
    selected && Number(amount) ? ((selected.calories * Number(amount)) / 100).toFixed(0) : '—';
  const disabled = !selected || Number(amount) <= 0;
  return (
    <>
      <Text style={[textStyles.label, { color: p.ink }]}>Amount</Text>
      <TextField
        accessibilityLabel="Food amount"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={(value) => onAmountChange(numericAmount(value))}
        trailing={<Text style={[textStyles.label, { color: p['ink-muted'] }]}>g</Text>}
      />
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>Total: {total} kcal</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onQueue}
        style={[styles.add, { backgroundColor: p.brand, opacity: disabled ? 0.55 : 1 }]}
      >
        <Text style={[textStyles.label, { color: p['on-brand'] }]}>{actionLabel}</Text>
      </Pressable>
    </>
  );
}

function numericAmount(value: string) {
  const [integer, ...fraction] = value.replace(/[^0-9.]/g, '').split('.');
  return fraction.length ? `${integer}.${fraction.join('')}` : integer;
}

function SelectedFoodPreview({
  food,
  amount,
  title = food.name,
}: Readonly<{ food: Food; amount: string; title?: string }>) {
  const p = usePalette();
  const grams = Number(amount) > 0 ? Number(amount) : 100;
  const multiplier = grams / 100;
  const macros = [
    [`${formatGrams(food.protein * multiplier)} g`, 'Protein'],
    [`${formatGrams(food.carbohydrates * multiplier)} g`, 'Carbs'],
    [`${formatGrams(food.fats * multiplier)} g`, 'Fat'],
  ];
  return (
    <View style={[styles.preview, { backgroundColor: p['brand-soft'] }]}>
      <Text style={[textStyles['title-md'], { color: p.ink }]}>{title}</Text>
      <View style={styles.macroRow}>
        {macros.map(([value, label]) => (
          <View key={label} style={styles.flex}>
            <Text style={[textStyles['metric-md'], { color: p.ink }]}>{value}</Text>
            <Text style={[textStyles.caption, { color: p['ink-muted'] }]}>{label}</Text>
          </View>
        ))}
      </View>
      <Text style={[textStyles.caption, { color: p['ink-muted'] }]}>Values per {grams} g</Text>
    </View>
  );
}

function formatGrams(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
}

function RecipePicker({
  accountId,
  meal,
  date,
  onNewRecipe,
  onEdit,
  onSaved,
  onClose,
}: Readonly<{
  accountId: number;
  meal: string;
  date: string;
  onNewRecipe: () => void;
  onEdit: (recipe: Recipe) => void;
  onSaved: () => void;
  onClose: () => void;
}>) {
  const p = usePalette();
  const queryClient = useQueryClient();
  const [selected, setSelected] = React.useState<Recipe | null>(null);
  const [recipeToDelete, setRecipeToDelete] = React.useState<Recipe | null>(null);
  const [servings, setServings] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const recipes = useQuery({
    queryKey: ['nutrition', 'recipes', debouncedSearch],
    queryFn: ({ signal }) =>
      debouncedSearch
        ? nutritionApi.searchRecipes(debouncedSearch, signal)
        : nutritionApi.recipes(signal),
    placeholderData: keepPreviousData,
  });
  const remove = useMutation({
    mutationFn: (recipeId: number) => nutritionApi.deleteRecipe(recipeId),
    onSuccess: (_, recipeId) => {
      if (selected?.id === recipeId) setSelected(null);
      setRecipeToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['nutrition', 'recipes'] });
    },
  });
  const save = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Select a recipe first.');
      return nutritionApi.addRecipeMealItem({
        date,
        meal_type: mealTypeFor(meal),
        recipe_id: selected.id,
        servings: Number(servings),
      });
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const validServings = Number(servings) > 0;
  const toggleRecipeSelection = (recipe: Recipe) => {
    setSelected((current) => (current?.id === recipe.id ? null : recipe));
    setServings('');
  };

  return (
    <View style={styles.recipeForm}>
      <Pressable
        accessibilityRole="button"
        onPress={onNewRecipe}
        style={[styles.newRecipe, { borderColor: p['brand-ink'] }]}
      >
        <Feather name="plus" size={20} color={p['brand-ink']} />
        <Text style={[textStyles.label, { color: p['brand-ink'] }]}>New recipe</Text>
      </Pressable>
      <Text style={[textStyles.label, { color: p.ink }]}>Search</Text>
      <TextField
        accessibilityLabel="Search recipe"
        leading={<Feather name="search" size={20} color={p['ink-muted']} />}
        value={search}
        onChangeText={setSearch}
        placeholder="Chicken rice, pasta…"
      />
      <View style={[styles.results, { backgroundColor: p['surface-200'] }]}>
        {recipes.data?.map((recipe) => (
          <React.Fragment key={recipe.id}>
            <View style={styles.recipeRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: selected?.id === recipe.id }}
                accessibilityLabel={`Select ${recipe.name}`}
                onPress={() => toggleRecipeSelection(recipe)}
                style={({ pressed }) => [styles.recipeSelect, { opacity: pressed ? 0.65 : 1 }]}
              >
                <View
                  style={[
                    styles.foodIcon,
                    {
                      backgroundColor: p['surface-300'],
                      borderColor: selected?.id === recipe.id ? p['brand-ink'] : 'transparent',
                      borderWidth: 2,
                    },
                  ]}
                >
                  <Feather name="book-open" size={20} color={p['brand-ink']} />
                </View>
                <View style={styles.flex}>
                  <Text style={[textStyles.body, { color: p.ink }]}>{recipe.name}</Text>
                  <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                    Per serving · {recipe.calories.toFixed(0)} kcal
                  </Text>
                </View>
              </Pressable>
              {recipe.user_id === accountId ? (
                <View style={styles.itemActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${recipe.name}`}
                    hitSlop={spacing['space-1']}
                    onPress={() => onEdit(recipe)}
                    style={styles.editItem}
                  >
                    <Feather name="edit-2" size={19} color={p['brand-ink']} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${recipe.name}`}
                    accessibilityState={{ disabled: remove.isPending }}
                    disabled={remove.isPending}
                    onPress={() => {
                      remove.reset();
                      setRecipeToDelete(recipe);
                    }}
                    hitSlop={spacing['space-2']}
                    style={styles.deleteRecipe}
                  >
                    <Feather name="trash-2" size={20} color={p.danger} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          </React.Fragment>
        ))}
        {debouncedSearch && !recipes.isPending && !recipes.data?.length ? (
          <Text style={[textStyles.body, { color: p['ink-muted'] }]}>No recipes found.</Text>
        ) : null}
        {!debouncedSearch && !recipes.isPending && !recipes.data?.length ? (
          <View style={styles.emptyRecipes}>
            <Feather name="book-open" size={22} color={p['ink-muted']} />
            <Text style={[textStyles.body, { color: p.ink }]}>No recipes saved yet</Text>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              Create one to add its servings to any meal.
            </Text>
          </View>
        ) : null}
      </View>
      <Modal
        transparent
        animationType="fade"
        visible={Boolean(recipeToDelete)}
        onRequestClose={() => setRecipeToDelete(null)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: p.scrim }]}>
          <View
            accessibilityViewIsModal
            style={[styles.deleteConfirmation, { backgroundColor: p['surface-200'] }]}
          >
            <View style={[styles.deleteIcon, { backgroundColor: p['surface-300'] }]}>
              <Feather name="trash-2" size={24} color={p.danger} />
            </View>
            <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
              {remove.isError ? 'Can’t delete recipe' : 'Delete recipe?'}
            </Text>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              {remove.isError
                ? `“${recipeToDelete?.name}” is already logged in your diary. Keep it to preserve your nutrition history.`
                : `“${recipeToDelete?.name}” will be permanently removed.`}
            </Text>
            <View style={styles.confirmationActions}>
              {remove.isError ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setRecipeToDelete(null)}
                  style={[styles.confirmButton, { backgroundColor: p['surface-300'] }]}
                >
                  <Text style={[textStyles.label, { color: p.ink }]}>Close</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setRecipeToDelete(null)}
                    style={[styles.confirmButton, { backgroundColor: p['surface-300'] }]}
                  >
                    <Text style={[textStyles.label, { color: p.ink }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={remove.isPending}
                    onPress={() => recipeToDelete && remove.mutate(recipeToDelete.id)}
                    style={[
                      styles.confirmButton,
                      { backgroundColor: p.danger, opacity: remove.isPending ? 0.55 : 1 },
                    ]}
                  >
                    <Text style={[textStyles.label, { color: p['on-brand'] }]}>Delete</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
      {selected ? (
        <>
          <Text style={[textStyles.label, { color: p.ink }]}>Servings</Text>
          <TextField
            accessibilityLabel="Recipe servings to add"
            keyboardType="decimal-pad"
            value={servings}
            onChangeText={setServings}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !validServings || save.isPending }}
            disabled={!validServings || save.isPending}
            onPress={() => save.mutate()}
            style={[
              styles.add,
              {
                backgroundColor: p.brand,
                opacity: !validServings || save.isPending ? 0.55 : 1,
              },
            ]}
          >
            <Text style={[textStyles.label, { color: p['on-brand'] }]}>
              {save.isPending ? 'Adding…' : `Add to ${meal}`}
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function FoodEditor({ food, onSaved }: Readonly<{ food: Food | null; onSaved: () => void }>) {
  const p = usePalette();
  const queryClient = useQueryClient();
  const [name, setName] = React.useState(food?.name ?? '');
  const [values, setValues] = React.useState({
    calories: food?.calories.toString() ?? '',
    protein: food?.protein.toString() ?? '',
    carbohydrates: food?.carbohydrates.toString() ?? '',
    fats: food?.fats.toString() ?? '',
  });
  const save = useMutation({
    mutationFn: () => {
      const input = {
        name: name.trim(),
        brand: food?.brand ?? null,
        barcode: food?.barcode ?? null,
        calories: Number(values.calories),
        protein: Number(values.protein),
        carbohydrates: Number(values.carbohydrates),
        fats: Number(values.fats),
      };
      return food ? nutritionApi.updateFood(food.id, input) : nutritionApi.createFood(input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['nutrition', 'foods'] });
      onSaved();
    },
  });
  const valid = Boolean(name.trim()) && Object.values(values).every((value) => Number(value) >= 0);
  const macroCalories =
    Number(values.protein || 0) * 4 +
    Number(values.carbohydrates || 0) * 4 +
    Number(values.fats || 0) * 9;

  const saveLabel = food ? 'Save changes' : 'Save food';
  return (
    <View style={styles.recipeForm}>
      <Text style={[textStyles['title-md'], { color: p.ink }]}>
        {food ? 'Edit food' : 'New food'}
      </Text>
      <Text style={[textStyles.label, { color: p.ink }]}>Name</Text>
      <TextField
        accessibilityLabel="Food name"
        value={name}
        onChangeText={setName}
        placeholder="Greek yogurt"
      />
      {(['calories', 'protein', 'carbohydrates', 'fats'] as const).map((field) => (
        <View key={field} style={styles.foodField}>
          <Text style={[textStyles.label, { color: p.ink }]}>
            {field === 'calories' ? 'Calories' : `${field[0].toUpperCase()}${field.slice(1)}`}
          </Text>
          <TextField
            accessibilityLabel={field}
            keyboardType="decimal-pad"
            value={values[field]}
            onChangeText={(value) =>
              setValues((current) => {
                const next = { ...current, [field]: value };
                const macrosComplete = (['protein', 'carbohydrates', 'fats'] as const).every(
                  (macro) => next[macro].trim() !== '' && Number.isFinite(Number(next[macro])),
                );
                if (field === 'calories' || !macrosComplete) return next;
                const estimate =
                  Number(next.protein) * 4 + Number(next.carbohydrates) * 4 + Number(next.fats) * 9;
                return { ...next, calories: estimate.toFixed(0) };
              })
            }
            trailing={
              <Text style={[textStyles.label, { color: p['ink-muted'] }]}>
                {field === 'calories' ? 'kcal' : 'g'}
              </Text>
            }
          />
        </View>
      ))}
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        Macro estimate: {macroCalories.toFixed(0)} kcal per 100 g
      </Text>
      {save.isError ? (
        <Text style={[textStyles['body-sm'], { color: p.danger }]}>Could not save food.</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={!valid || save.isPending}
        onPress={() => save.mutate()}
        style={[
          styles.add,
          { backgroundColor: p.brand, opacity: !valid || save.isPending ? 0.55 : 1 },
        ]}
      >
        <Text style={[textStyles.label, { color: p['on-brand'] }]}>
          {save.isPending ? 'Saving…' : saveLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function RecipeEditor({
  recipe,
  onSaved,
}: Readonly<{ recipe: Recipe | null; onSaved: () => void }>) {
  const p = usePalette();
  const queryClient = useQueryClient();
  const [name, setName] = React.useState(recipe?.name ?? '');
  const [servings, setServings] = React.useState(recipe?.servings.toString() ?? '1');
  const [search, setSearch] = React.useState('');
  const [ingredients, setIngredients] = React.useState<
    { food: Pick<Food, 'id' | 'name'>; grams: string }[]
  >(
    recipe?.ingredients.map((ingredient) => ({
      food: { id: ingredient.food_id, name: ingredient.name },
      grams: ingredient.quantity_grams.toString(),
    })) ?? [],
  );
  const results = useQuery({
    queryKey: ['nutrition', 'foods', 'recipe', search.trim()],
    enabled: Boolean(search.trim()),
    queryFn: ({ signal }) => nutritionApi.searchFoods(search.trim(), signal),
  });
  const save = useMutation({
    mutationFn: () => {
      const input = {
        name: name.trim(),
        servings: Number(servings),
        ingredients: ingredients.map(({ food, grams }) => ({
          food_id: food.id,
          quantity_grams: Number(grams),
        })),
      };
      return recipe
        ? nutritionApi.updateRecipe(recipe.id, input)
        : nutritionApi.createRecipe(input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['nutrition', 'recipes'] });
      onSaved();
    },
  });
  const valid =
    Boolean(name.trim()) &&
    Number.isInteger(Number(servings)) &&
    Number(servings) > 0 &&
    ingredients.length > 0 &&
    ingredients.every(({ grams }) => Number(grams) > 0);

  const saveLabel = recipe ? 'Save changes' : 'Create recipe';
  return (
    <View style={styles.recipeForm}>
      <Text style={[textStyles['title-md'], { color: p.ink }]}>
        {recipe ? 'Edit recipe' : 'Create recipe'}
      </Text>
      <Text style={[textStyles.label, { color: p.ink }]}>Recipe name</Text>
      <TextField
        accessibilityLabel="Recipe name"
        value={name}
        onChangeText={setName}
        placeholder="Chicken rice bowl"
      />
      <Text style={[textStyles.label, { color: p.ink }]}>Servings</Text>
      <TextField
        accessibilityLabel="Recipe servings"
        keyboardType="number-pad"
        value={servings}
        onChangeText={setServings}
      />
      <Text style={[textStyles.label, { color: p.ink }]}>Add ingredients</Text>
      <TextField
        accessibilityLabel="Search ingredient"
        leading={<Feather name="search" size={20} color={p['ink-muted']} />}
        value={search}
        onChangeText={setSearch}
        placeholder="Search foods…"
      />
      {results.data?.map((food) => (
        <Pressable
          key={food.id}
          accessibilityRole="button"
          accessibilityLabel={`Add ${food.name} as an ingredient`}
          onPress={() => {
            setIngredients((current) => [...current, { food, grams: '100' }]);
            setSearch('');
          }}
          style={[styles.ingredientSearchRow, { borderColor: p.line }]}
        >
          <Text style={[textStyles.body, styles.flex, { color: p.ink }]}>{food.name}</Text>
          <Feather name="plus" size={20} color={p['brand-ink']} />
        </Pressable>
      ))}
      {ingredients.map(({ food, grams }, index) => (
        <View
          key={`${food.id}-${index}`}
          style={[styles.ingredientRow, { backgroundColor: p['surface-200'] }]}
        >
          <Text style={[textStyles.body, styles.flex, { color: p.ink }]}>{food.name}</Text>
          <TextField
            accessibilityLabel={`${food.name} quantity`}
            keyboardType="decimal-pad"
            value={grams}
            onChangeText={(value) =>
              setIngredients((current) =>
                current.map((ingredient, itemIndex) =>
                  itemIndex === index ? { ...ingredient, grams: value } : ingredient,
                ),
              )
            }
            containerStyle={{ width: 88 }}
            inputStyle={{ textAlign: 'right' }}
            trailing={<Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>g</Text>}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${food.name}`}
            onPress={() =>
              setIngredients((current) => current.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            <Feather name="x" size={20} color={p['ink-muted']} />
          </Pressable>
        </View>
      ))}
      {save.isError ? (
        <Text style={[textStyles['body-sm'], { color: p.danger }]}>Could not save recipe.</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !valid || save.isPending }}
        disabled={!valid || save.isPending}
        onPress={() => save.mutate()}
        style={[
          styles.add,
          { backgroundColor: p.brand, opacity: !valid || save.isPending ? 0.55 : 1 },
        ]}
      >
        <Text style={[textStyles.label, { color: p['on-brand'] }]}>
          {save.isPending ? 'Saving…' : saveLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { display: 'none' },
  screen: { flex: 1 },
  foodPickerContent: { flex: 1, minHeight: 0, paddingBottom: 0 },
  foodListScroll: { flex: 1, minHeight: 0 },
  foodListContent: { gap: spacing['space-3'], paddingBottom: spacing['space-4'] },
  reviewFooter: { padding: spacing['space-4'] },
  content: {
    padding: spacing['space-4'],
    gap: spacing['space-3'],
    paddingBottom: spacing['space-10'],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-3'] },
  back: {
    width: sizes['tap-min'],
    height: sizes['tap-min'],
    borderRadius: radii['radius-pill'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  chips: { flexDirection: 'row', gap: spacing['space-2'] },
  chip: {
    minHeight: sizes['control-height-sm'],
    paddingHorizontal: spacing['space-3'],
    borderRadius: radii['radius-pill'],
    justifyContent: 'center',
  },
  recipeForm: { gap: spacing['space-3'] },
  foodField: { gap: spacing['space-2'] },
  newRecipe: {
    minHeight: sizes['control-height-sm'],
    borderWidth: 1,
    borderRadius: radii['radius-pill'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['space-2'],
  },
  ingredientSearchRow: {
    minHeight: sizes['control-height-sm'],
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    gap: spacing['space-2'],
  },
  ingredientRow: {
    minHeight: sizes['control-height'],
    borderRadius: radii['radius-md'],
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing['space-3'],
    gap: spacing['space-2'],
  },
  recipeRow: { flexDirection: 'row', alignItems: 'center' },
  recipeSelect: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-3'],
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing['space-3'],
  },
  deleteRecipe: {
    width: 36,
    height: sizes['tap-min'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  editItem: {
    width: 36,
    height: sizes['tap-min'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmation: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii['radius-xl'],
    padding: spacing['space-5'],
    gap: spacing['space-3'],
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['space-4'],
  },
  deleteIcon: {
    width: sizes['tap-min'],
    height: sizes['tap-min'],
    borderRadius: radii['radius-pill'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmationActions: {
    flexDirection: 'row',
    gap: spacing['space-2'],
    marginTop: spacing['space-1'],
  },
  confirmButton: {
    flex: 1,
    minHeight: sizes['control-height-sm'],
    borderRadius: radii['radius-pill'],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['space-3'],
  },
  results: { borderRadius: radii['radius-lg'], paddingHorizontal: spacing['space-4'] },
  queueRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-3'],
  },
  emptyRecipes: {
    minHeight: 128,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['space-2'],
  },
  foodRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing['space-3'] },
  foodIcon: {
    width: 44,
    height: 44,
    borderRadius: radii['radius-md'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  flex: { flex: 1 },
  preview: {
    borderRadius: radii['radius-lg'],
    padding: spacing['space-4'],
    gap: spacing['space-3'],
  },
  macroRow: { flexDirection: 'row', gap: spacing['space-2'] },
  reviewSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-3'] },
  reviewMacro: { flexDirection: 'row', alignItems: 'baseline', gap: spacing['space-1'] },
  tabular: { fontVariant: ['tabular-nums'] },
  add: {
    minHeight: sizes['control-height'],
    marginTop: spacing['space-3'],
    borderRadius: radii['radius-pill'],
    justifyContent: 'center',
    alignItems: 'center',
  },
});
