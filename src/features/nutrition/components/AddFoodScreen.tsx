import { Feather } from '@expo/vector-icons';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedTextSelector } from '@/components/AnimatedTextSelector';
import { TextField } from '@/components/TextField';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { nutritionApi } from '../api';
import type { Food, Recipe } from '../schemas';
import { useFoodCatalogue } from '../useFoodCatalogue';
import { NutritionSummary, type NutritionValues } from './NutritionSummary';

type QueuedEntry =
  | { kind: 'food'; source: Food; amount: number }
  | { kind: 'recipe'; source: Recipe; amount: number };

const entryKey = (entry: QueuedEntry) => `${entry.kind}:${entry.source.id}`;
const nutritionFactor = (entry: QueuedEntry) =>
  entry.kind === 'food' ? entry.amount / 100 : entry.amount;
const roundedAmount = (value: string) => Math.round(Number(value) * 100) / 100;
const validAmount = (value: string) =>
  roundedAmount(value) > 0 && roundedAmount(value) <= 999999.99;

const entityTypes = ['Food', 'Recipe'] as const;
type EntityType = (typeof entityTypes)[number];

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
  const [tab, setTab] = React.useState<EntityType>('Food');
  const [creationType, setCreationType] = React.useState<EntityType | null>(null);
  const [reduceMotion, setReduceMotion] = React.useState(true);
  React.useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  const creationFormScroll = React.useRef<ScrollView>(null);
  const closeCreation = () => setCreationType(null);
  const [showFoodEditor, setShowFoodEditor] = React.useState(false);
  const [showRecipeEditor, setShowRecipeEditor] = React.useState(false);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Food | null>(null);
  const [foodToDelete, setFoodToDelete] = React.useState<Food | null>(null);
  const [editingFood, setEditingFood] = React.useState<Food | null>(null);
  const [editingRecipe, setEditingRecipe] = React.useState<Recipe | null>(null);
  const [amount, setAmount] = React.useState('');
  const [previewAmount, setPreviewAmount] = React.useState('');
  const [queuedEntries, setQueuedEntries] = React.useState<QueuedEntry[]>([]);
  const [reviewingEntries, setReviewingEntries] = React.useState(false);
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
  const results = useFoodCatalogue(debouncedSearch, tab === 'Food' && !showFoodEditor);
  const foodList = React.useRef<ScrollView>(null);
  const visibleFoodSearch = search.trim() === debouncedSearch;
  const saveQueue = useMutation({
    mutationFn: async () => {
      const context = { date, meal_type: mealTypeFor(meal) };
      const results = await Promise.allSettled(
        queuedEntries.map(async (entry) =>
          entry.kind === 'food'
            ? nutritionApi.addMealItem({
                ...context,
                food_id: entry.source.id,
                quantity_grams: entry.amount,
              })
            : nutritionApi.addRecipeMealItem({
                ...context,
                recipe_id: entry.source.id,
                servings: entry.amount,
              }),
        ),
      );
      const failed = queuedEntries.filter((_, index) => results[index].status === 'rejected');
      setQueuedEntries(failed);
      if (failed.length < queuedEntries.length) onSaved();
      if (failed.length) throw new Error('Some entries could not be added.');
    },
    onSuccess: onClose,
  });
  const queueEntry = (entry: QueuedEntry) => {
    setQueuedEntries((current) =>
      current.some((item) => entryKey(item) === entryKey(entry))
        ? current.map((item) => (entryKey(item) === entryKey(entry) ? entry : item))
        : [...current, entry],
    );
  };
  const queueSelectedFood = () => {
    if (!selected || !validAmount(amount)) return;
    queueEntry({ kind: 'food', source: selected, amount: roundedAmount(amount) });
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
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p['surface-100'] }]}>
      <ScrollView
        aria-hidden={creationType !== null}
        style={{ flex: 1, minHeight: 0 }}
        scrollEnabled={!(tab === 'Food' && !showFoodEditor && !reviewingEntries)}
        contentContainerStyle={[
          styles.content,
          tab === 'Food' && !showFoodEditor && !reviewingEntries && styles.foodPickerContent,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={reviewingEntries ? 'Back to selection' : 'Back to nutrition'}
            disabled={saveQueue.isPending}
            onPress={() => {
              if (reviewingEntries) {
                saveQueue.reset();
                setReviewingEntries(false);
                return;
              }
              onClose();
            }}
            style={[styles.back, { backgroundColor: p['surface-300'] }]}
          >
            <Feather name="arrow-left" size={24} color={p.ink} />
          </Pressable>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[textStyles['title-lg'], { color: p.ink }]}>
              Add food
            </Text>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{meal}</Text>
          </View>
          {!reviewingEntries ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create"
              onPress={() => setCreationType(tab)}
              style={[styles.createButton, { backgroundColor: p['brand-soft'] }]}
            >
              <Feather name="plus" size={20} color={p['brand-ink']} />
              <Text style={[textStyles.label, { color: p['brand-ink'] }]}>Create</Text>
            </Pressable>
          ) : null}
        </View>
        {!reviewingEntries ? (
          <View
            accessibilityRole="tablist"
            accessibilityLabel="Catalogue type"
            style={styles.header}
          >
            {entityTypes.map((label) => (
              <AnimatedTextSelector
                key={label}
                label={label}
                selected={tab === label}
                role="tab"
                reduceMotion={reduceMotion}
                onPress={() => setTab(label)}
                equalWidth
              />
            ))}
          </View>
        ) : null}
        {tab === 'Food' && showFoodEditor && !reviewingEntries ? (
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
        {tab === 'Food' && !showFoodEditor && !reviewingEntries ? (
          <>
            <Text style={[textStyles.label, { color: p.ink }]}>Search</Text>
            <TextField
              accessibilityLabel="Search food"
              maxLength={150}
              leading={<Feather name="search" size={20} color={p['ink-muted']} />}
              value={search}
              onChangeText={(value) => {
                setSearch(value);
                setSelected(null);
                setAmount('');
                setPreviewAmount('');
                foodList.current?.scrollTo({ y: 0, animated: false });
              }}
              placeholder="Chicken, rice, yogurt…"
            />
          </>
        ) : null}
        {tab === 'Recipe' && showRecipeEditor && !reviewingEntries ? (
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
          <View style={tab === 'Recipe' && !reviewingEntries ? undefined : styles.hidden}>
            <RecipePicker
              queuedRecipeIds={queuedEntries
                .filter((item) => item.kind === 'recipe')
                .map((item) => item.source.id)}
              onQueue={(recipe, servings) =>
                queueEntry({ kind: 'recipe', source: recipe, amount: servings })
              }
              onEdit={(recipe) => {
                setEditingRecipe(recipe);
                setShowRecipeEditor(true);
              }}
              accountId={accountId}
            />
          </View>
        ) : null}
        {reviewingEntries ? (
          <EntryQueueReview
            meal={meal}
            entries={queuedEntries}
            pending={saveQueue.isPending}
            error={saveQueue.isError}
            onBack={() => {
              saveQueue.reset();
              setReviewingEntries(false);
            }}
            onRemove={(key) => {
              const remaining = queuedEntries.filter((item) => entryKey(item) !== key);
              setQueuedEntries(remaining);
              if (!remaining.length) setReviewingEntries(false);
            }}
            onUpdateAmount={(key, amount) =>
              setQueuedEntries((current) =>
                current.map((item) => (entryKey(item) === key ? { ...item, amount } : item)),
              )
            }
            onConfirm={() => saveQueue.mutate()}
          />
        ) : null}
        {tab === 'Food' && !showFoodEditor && !reviewingEntries ? (
          <ScrollView
            ref={foodList}
            style={styles.foodListScroll}
            contentContainerStyle={styles.foodListContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <FoodContent
              foods={visibleFoodSearch ? results.foods : []}
              isPending={!visibleFoodSearch || results.isPending}
              search={debouncedSearch}
              selected={selected}
              queuedFoodIds={queuedEntries
                .filter((item) => item.kind === 'food')
                .map((item) => item.source.id)}
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
            {visibleFoodSearch && !selected ? <FoodPageAction catalogue={results} /> : null}
          </ScrollView>
        ) : null}
      </ScrollView>
      {!reviewingEntries && queuedEntries.length > 0 ? (
        <View style={[styles.reviewFooter, { backgroundColor: p['surface-100'] }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setReviewingEntries(true)}
            style={[styles.add, { marginTop: 0, backgroundColor: p.brand }]}
          >
            <Text style={[textStyles.label, { color: p['on-brand'] }]}>
              Review {queuedEntries.length} {queuedEntries.length === 1 ? 'entry' : 'entries'}
            </Text>
          </Pressable>
        </View>
      ) : null}
      <Modal
        visible={creationType !== null}
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={closeCreation}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.creationOverlay}
        >
          <SafeAreaView
            edges={['top', 'bottom', 'left', 'right']}
            accessibilityViewIsModal
            style={[styles.creationSheet, { backgroundColor: p['surface-200'] }]}
          >
            <View style={styles.header}>
              <Text
                accessibilityRole="header"
                style={[textStyles['title-md'], styles.heading, { color: p.ink }]}
              >
                {creationType === 'Recipe' ? 'Create recipe' : 'Create food'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close creation"
                onPress={closeCreation}
                style={[styles.back, { backgroundColor: p['surface-300'] }]}
              >
                <Feather name="x" size={24} color={p.ink} />
              </Pressable>
            </View>
            <View
              accessibilityRole="tablist"
              accessibilityLabel="Creation type"
              style={styles.header}
            >
              {entityTypes.map((label) => (
                <AnimatedTextSelector
                  key={label}
                  label={label}
                  selected={creationType === label}
                  role="tab"
                  reduceMotion={reduceMotion}
                  onPress={() => {
                    if (creationType === label) return;
                    setCreationType(label);
                    creationFormScroll.current?.scrollTo({ y: 0, animated: false });
                  }}
                  equalWidth
                />
              ))}
            </View>
            {creationType !== null ? (
              <ScrollView
                ref={creationFormScroll}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.recipeForm}
              >
                <View style={creationType === 'Food' ? undefined : styles.hidden}>
                  <FoodEditor food={null} onSaved={closeCreation} />
                </View>
                <View style={creationType === 'Recipe' ? undefined : styles.hidden}>
                  <RecipeEditor recipe={null} onSaved={closeCreation} />
                </View>
              </ScrollView>
            ) : null}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function FoodPageAction({
  catalogue,
}: Readonly<{ catalogue: ReturnType<typeof useFoodCatalogue> }>) {
  const p = usePalette();
  if (!catalogue.hasNextPage && !catalogue.isError) return null;
  const retry = catalogue.isError;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={catalogue.isFetching}
      onPress={() =>
        void (retry && !catalogue.isFetchNextPageError
          ? catalogue.refetch()
          : catalogue.fetchNextPage())
      }
      style={[styles.pageAction, { backgroundColor: p['surface-300'] }]}
    >
      <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
        {catalogue.isFetchingNextPage
          ? 'Loading foods…'
          : retry
            ? 'Retry loading foods'
            : 'Load more foods'}
      </Text>
    </Pressable>
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
          <EntryAmount
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
                {selected?.id !== food.id ? (
                  <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                    Per 100 g · {food.calories} kcal
                  </Text>
                ) : null}
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

function EntryQueueReview({
  meal,
  entries,
  pending,
  error,
  onBack,
  onRemove,
  onUpdateAmount,
  onConfirm,
}: Readonly<{
  meal: string;
  entries: QueuedEntry[];
  pending: boolean;
  error: boolean;
  onBack: () => void;
  onRemove: (key: string) => void;
  onUpdateAmount: (key: string, amount: number) => void;
  onConfirm: () => void;
}>) {
  const p = usePalette();
  const [editingEntry, setEditingEntry] = React.useState<QueuedEntry | null>(null);
  const [draftQuantity, setDraftQuantity] = React.useState('');
  const totals = entries.reduce(
    (current, item) => {
      const multiplier = nutritionFactor(item);
      return {
        calories: current.calories + item.source.calories * multiplier,
        protein: current.protein + item.source.protein * multiplier,
        carbohydrates: current.carbohydrates + item.source.carbohydrates * multiplier,
        fats: current.fats + item.source.fats * multiplier,
      };
    },
    { calories: 0, protein: 0, carbohydrates: 0, fats: 0 },
  );
  const editingIndex = editingEntry
    ? entries.findIndex((item) => entryKey(item) === entryKey(editingEntry))
    : -1;
  const visibleEntries = editingIndex >= 0 ? entries.slice(0, editingIndex + 1) : entries;
  const confirmDisabled = pending || Boolean(editingEntry) || !entries.length;
  return (
    <View style={styles.recipeForm}>
      <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
        Review entries
      </Text>
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        Check your selection before adding it to {meal}.
      </Text>
      <View style={[styles.results, { backgroundColor: p['surface-200'] }]}>
        {visibleEntries.map((item) => {
          return (
            <View key={entryKey(item)} style={styles.queueRow}>
              <View style={styles.flex}>
                <Text style={[textStyles.body, { color: p.ink }]}>{item.source.name}</Text>
                <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                  {item.amount}{' '}
                  {item.kind === 'food' ? 'g' : item.amount === 1 ? 'serving' : 'servings'} ·{' '}
                  {Math.round(item.source.calories * nutritionFactor(item))} kcal
                </Text>
              </View>
              <View style={styles.itemActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.source.name} quantity`}
                  disabled={pending}
                  onPress={() => {
                    if (editingEntry && entryKey(editingEntry) === entryKey(item)) {
                      setEditingEntry(null);
                      setDraftQuantity('');
                      return;
                    }
                    setEditingEntry(item);
                    setDraftQuantity(String(item.amount));
                  }}
                  style={styles.editItem}
                >
                  <Feather name="edit-2" size={19} color={p['brand-ink']} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.source.name} from selection`}
                  disabled={pending}
                  onPress={() => {
                    if (editingEntry && entryKey(editingEntry) === entryKey(item)) {
                      setEditingEntry(null);
                      setDraftQuantity('');
                    }
                    onRemove(entryKey(item));
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
      {editingEntry ? (
        <>
          {editingEntry.kind === 'food' ? (
            <SelectedFoodPreview food={editingEntry.source} amount={draftQuantity} />
          ) : (
            <NutritionSummary values={editingEntry.source} factor={Number(draftQuantity) || 0} />
          )}
          <EntryAmount
            selected={editingEntry.source}
            unit={editingEntry.kind === 'food' ? 'g' : 'servings'}
            amount={draftQuantity}
            onAmountChange={setDraftQuantity}
            actionLabel="Save changes"
            disabled={pending}
            onQueue={() => {
              if (!validAmount(draftQuantity)) return;
              onUpdateAmount(entryKey(editingEntry), roundedAmount(draftQuantity));
              setEditingEntry(null);
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
        <NutritionSummary values={totals} precision={1} />
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
          Some entries could not be added. Review the remaining selection and try again.
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
          accessibilityState={{ disabled: confirmDisabled }}
          disabled={confirmDisabled}
          onPress={onConfirm}
          style={[
            styles.confirmButton,
            { backgroundColor: p.brand, opacity: confirmDisabled ? 0.55 : 1 },
          ]}
        >
          <Text style={[textStyles.label, { color: p['on-brand'] }]}>
            {pending
              ? 'Adding…'
              : `Add ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} to ${meal}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function EntryAmount({
  selected,
  amount,
  onAmountChange,
  onQueue,
  actionLabel = 'Add food',
  unit = 'g',
  disabled: pending = false,
}: Readonly<{
  selected: Food | Recipe | null;
  amount: string;
  onAmountChange: (amount: string) => void;
  onQueue: () => void;
  actionLabel?: string;
  unit?: 'g' | 'servings';
  disabled?: boolean;
}>) {
  const p = usePalette();
  const disabled = pending || !selected || !validAmount(amount);
  return (
    <>
      <Text style={[textStyles.label, { color: p.ink }]}>
        {unit === 'g' ? 'Amount' : 'Servings'}
      </Text>
      <TextField
        accessibilityLabel={unit === 'g' ? 'Food amount' : 'Recipe servings to add'}
        editable={!pending}
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={(value) => onAmountChange(numericAmount(value))}
        trailing={<Text style={[textStyles.label, { color: p['ink-muted'] }]}>{unit}</Text>}
      />
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

function SelectedFoodPreview({ food, amount }: Readonly<{ food: Food; amount: string }>) {
  const p = usePalette();
  const grams = Number(amount) > 0 ? Number(amount) : 100;
  return (
    <View style={styles.nutritionDetails}>
      <NutritionSummary values={food} factor={grams / 100} precision={1} />
      <Text style={[textStyles.caption, { color: p['ink-muted'] }]}>Values per {grams} g</Text>
    </View>
  );
}

function formatGrams(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}

function RecipePicker({
  accountId,
  queuedRecipeIds,
  onQueue,
  onEdit,
}: Readonly<{
  accountId: number;
  queuedRecipeIds: number[];
  onQueue: (recipe: Recipe, amount: number) => void;
  onEdit: (recipe: Recipe) => void;
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
  const toggleRecipeSelection = (recipe: Recipe) => {
    setSelected((current) => (current?.id === recipe.id ? null : recipe));
    setServings('');
  };

  return (
    <View style={styles.recipeForm}>
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
                accessibilityState={{
                  selected: selected?.id === recipe.id || queuedRecipeIds.includes(recipe.id),
                }}
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
        <EntryAmount
          selected={selected}
          amount={servings}
          unit="servings"
          onAmountChange={setServings}
          actionLabel="Add recipe"
          onQueue={() => {
            if (!validAmount(servings)) return;
            onQueue(selected, roundedAmount(servings));
            setSelected(null);
            setServings('');
          }}
        />
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
    },
  });
  const valid = Boolean(name.trim()) && Object.values(values).every((value) => Number(value) >= 0);
  return (
    <View style={styles.recipeForm}>
      {food ? <Text style={[textStyles['title-md'], { color: p.ink }]}>Edit food</Text> : null}
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
      {save.isError ? (
        <Text style={[textStyles['body-sm'], { color: p.danger }]}>Could not save food.</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={!valid || save.isPending}
        onPress={() => save.mutate(undefined, { onSuccess: onSaved })}
        style={[
          styles.add,
          { backgroundColor: p.brand, opacity: !valid || save.isPending ? 0.55 : 1 },
        ]}
      >
        <Text style={[textStyles.label, { color: p['on-brand'] }]}>
          {save.isPending ? 'Saving…' : food ? 'Save changes' : 'Save food'}
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
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const term = search.trim();
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(term), 300);
    return () => clearTimeout(timer);
  }, [term]);
  const [ingredients, setIngredients] = React.useState<
    { food: Pick<Food, 'id' | 'name'>; grams: string; nutrition: NutritionValues | null }[]
  >(
    recipe?.ingredients.map((ingredient) => ({
      food: { id: ingredient.food_id, name: ingredient.name },
      grams: ingredient.quantity_grams.toString(),
      nutrition: null,
    })) ?? [],
  );
  const results = useFoodCatalogue(debouncedSearch, Boolean(term) && term === debouncedSearch);
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
    },
  });
  const servingCount = Number(servings);
  const validServings = Number.isInteger(servingCount) && servingCount > 0 && servingCount <= 100;
  const validQuantities =
    ingredients.length > 0 &&
    ingredients.every(({ grams }) => Number.isFinite(Number(grams)) && Number(grams) > 0);
  const valid = Boolean(name.trim()) && validServings && validQuantities;

  // Food nutrition is per 100 g. Sum unrounded contributions before dividing by servings.
  const totals: NutritionValues = { calories: 0, protein: 0, carbohydrates: 0, fats: 0 };
  const showEstimate =
    validServings && validQuantities && ingredients.every((item) => item.nutrition);
  if (showEstimate) {
    for (const { nutrition, grams } of ingredients) {
      if (!nutrition) continue;
      const factor = Number(grams) / 100;
      totals.calories += nutrition.calories * factor;
      totals.protein += nutrition.protein * factor;
      totals.carbohydrates += nutrition.carbohydrates * factor;
      totals.fats += nutrition.fats * factor;
    }
  }

  return (
    <View style={styles.recipeForm}>
      {recipe ? <Text style={[textStyles['title-md'], { color: p.ink }]}>Edit recipe</Text> : null}
      <View style={styles.recipeFields}>
        <Text style={[textStyles.label, { color: p.ink }]}>Recipe name</Text>
        <TextField
          accessibilityLabel="Recipe name"
          value={name}
          onChangeText={setName}
          placeholder="Chicken rice bowl"
          containerStyle={styles.compactField}
          inputStyle={styles.compactInput}
        />
        <View style={styles.servingRow}>
          <Text style={[textStyles.label, styles.flex, { color: p.ink }]}>Servings</Text>
          {([-1, 1] as const).map((change) => {
            const decrement = change < 0;
            const disabled = decrement ? servingCount <= 1 : servingCount >= 100;
            return (
              <React.Fragment key={change}>
                {!decrement ? (
                  <TextField
                    accessibilityLabel="Recipe servings"
                    keyboardType="number-pad"
                    maxLength={3}
                    value={servings}
                    onChangeText={(value) => setServings(value.replace(/[^0-9]/g, ''))}
                    containerStyle={[styles.compactField, styles.servingField]}
                    inputStyle={[styles.compactInput, styles.servingInput]}
                  />
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={decrement ? 'Decrease servings' : 'Increase servings'}
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  onPress={() =>
                    setServings(String(Math.min(100, Math.max(1, servingCount + change))))
                  }
                  style={[
                    styles.stepperButton,
                    { backgroundColor: p['surface-300'], opacity: disabled ? 0.5 : 1 },
                  ]}
                >
                  <Feather name={decrement ? 'minus' : 'plus'} size={18} color={p.ink} />
                </Pressable>
              </React.Fragment>
            );
          })}
        </View>
      </View>
      <View style={styles.recipeFields}>
        <Text style={[textStyles.label, { color: p.ink }]}>Ingredients</Text>
        <TextField
          accessibilityLabel="Search ingredient"
          maxLength={150}
          leading={<Feather name="search" size={18} color={p['ink-muted']} />}
          value={search}
          onChangeText={setSearch}
          placeholder="Search foods…"
          containerStyle={styles.compactField}
          inputStyle={styles.compactInput}
        />
      </View>
      {term ? (
        <ScrollView
          style={[styles.ingredientResults, { backgroundColor: p['surface-100'] }]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          accessibilityLabel="Ingredient search results"
        >
          {term === debouncedSearch && results.foods.length ? (
            results.foods.map((food) => (
              <Pressable
                key={food.id}
                accessibilityRole="button"
                accessibilityLabel={`Add ${food.name} as an ingredient`}
                onPress={() => {
                  setIngredients((current) => [
                    ...current,
                    { food, grams: '100', nutrition: food },
                  ]);
                  setSearch('');
                  setDebouncedSearch('');
                }}
                style={[styles.ingredientSearchRow, { borderColor: p.line }]}
              >
                <Text style={[textStyles.body, styles.flex, { color: p.ink }]}>{food.name}</Text>
                <Feather name="plus" size={20} color={p['brand-ink']} />
              </Pressable>
            ))
          ) : (
            <Text
              style={[
                textStyles['body-sm'],
                styles.ingredientSearchHint,
                { color: p['ink-muted'] },
              ]}
            >
              {term !== debouncedSearch || results.isPending
                ? 'Searching…'
                : results.isError
                  ? 'Could not load foods'
                  : 'No foods found'}
            </Text>
          )}
          {term === debouncedSearch ? <FoodPageAction catalogue={results} /> : null}
        </ScrollView>
      ) : null}
      {ingredients.map(({ food, grams, nutrition }, index) => (
        <View
          key={`${food.id}-${index}`}
          style={[styles.ingredientRow, { backgroundColor: p['surface-200'] }]}
        >
          <View style={styles.ingredientControls}>
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
              containerStyle={[styles.compactField, styles.ingredientQuantity]}
              inputStyle={[styles.compactInput, styles.amountInput]}
              trailing={<Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>g</Text>}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${food.name}`}
              style={styles.stepperButton}
              onPress={() =>
                setIngredients((current) => current.filter((_, itemIndex) => itemIndex !== index))
              }
            >
              <Feather name="x" size={20} color={p['ink-muted']} />
            </Pressable>
          </View>
          {nutrition && Number.isFinite(Number(grams)) && Number(grams) > 0 ? (
            <NutritionSummary
              values={nutrition}
              factor={Number(grams) / 100}
              precision={2}
              compact
            />
          ) : null}
        </View>
      ))}
      {showEstimate && (ingredients.length > 1 || servingCount !== 1) ? (
        <View style={[styles.recipeTotal, { backgroundColor: p['surface-300'] }]}>
          <NutritionSummary values={totals} factor={1 / servingCount} precision={2} perServing />
        </View>
      ) : null}
      {save.isError ? (
        <Text style={[textStyles['body-sm'], { color: p.danger }]}>Could not save recipe.</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !valid || save.isPending }}
        disabled={!valid || save.isPending}
        onPress={() => save.mutate(undefined, { onSuccess: onSaved })}
        style={[
          styles.add,
          { backgroundColor: p.brand, opacity: !valid || save.isPending ? 0.55 : 1 },
        ]}
      >
        <Text style={[textStyles.label, { color: p['on-brand'] }]}>
          {save.isPending ? 'Saving…' : recipe ? 'Save changes' : 'Create recipe'}
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
  heading: { flex: 1 },
  recipeForm: { gap: spacing['space-3'] },
  foodField: { gap: spacing['space-2'] },
  createButton: {
    minHeight: sizes['tap-min'],
    paddingHorizontal: spacing['space-3'],
    borderRadius: radii['radius-pill'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['space-2'],
  },
  creationOverlay: { flex: 1 },
  creationSheet: {
    flex: 1,
    padding: spacing['space-4'],
    gap: spacing['space-3'],
  },
  pageAction: {
    minHeight: sizes['tap-min'],
    paddingHorizontal: spacing['space-3'],
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii['radius-md'],
  },
  recipeFields: { gap: spacing['space-2'] },
  compactField: { minHeight: sizes['tap-min'] },
  compactInput: { minHeight: sizes['tap-min'] - 2, paddingVertical: 0 },
  servingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-1'] },
  servingField: { width: 60, paddingHorizontal: spacing['space-1'] },
  servingInput: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  stepperButton: {
    width: sizes['tap-min'],
    minHeight: sizes['tap-min'],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii['radius-md'],
  },
  ingredientQuantity: { width: 88, paddingHorizontal: spacing['space-2'] },
  amountInput: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  recipeTotal: { padding: spacing['space-3'], borderRadius: radii['radius-md'] },
  ingredientResults: {
    maxHeight: 3 * sizes['control-height-sm'],
    flexGrow: 0,
    flexShrink: 0,
    borderRadius: radii['radius-md'],
  },
  ingredientSearchHint: { padding: spacing['space-3'] },
  ingredientSearchRow: {
    paddingHorizontal: spacing['space-3'],
    minHeight: sizes['control-height-sm'],
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    gap: spacing['space-2'],
  },
  ingredientRow: {
    borderRadius: radii['radius-md'],
    padding: spacing['space-3'],
    gap: spacing['space-1'],
  },
  ingredientControls: {
    flexDirection: 'row',
    alignItems: 'center',
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
  nutritionDetails: { gap: spacing['space-1'] },
  add: {
    minHeight: sizes['control-height'],
    marginTop: spacing['space-3'],
    borderRadius: radii['radius-pill'],
    justifyContent: 'center',
    alignItems: 'center',
  },
});
