import { getTranslation } from '@/i18n/catalog';
import type { ScrollViewInstance } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  FlatList,
  Keyboard,
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

import { useLanguage } from '@/i18n/Language';
import { AnimatedTextSelector } from '@/components/AnimatedTextSelector';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { nutritionApi } from '../api';
import type { Food, Recipe } from '../schemas';
import { useFoodCatalogue, useRecipeCatalogue } from '../useNutritionCatalogue';
import {
  NutritionSummary,
  PortionNutritionPreview,
  type NutritionValues,
} from './NutritionSummary';

type EntrySource = { kind: 'food'; source: Food } | { kind: 'recipe'; source: Recipe };
type QueuedEntry = EntrySource & { amount: number };

const entryKey = (entry: EntrySource) => `${entry.kind}:${entry.source.id}`;
const nutritionFactor = (entry: QueuedEntry) =>
  entry.kind === 'food' ? entry.amount / 100 : entry.amount;
function entryUnit(kind: EntrySource['kind'], amount: number): string {
  if (kind === 'food') return 'g';
  return amount === 1 ? 'serving' : 'servings';
}

function saveLabel(pending: boolean, editing: boolean, createLabel: string, es: boolean): string {
  if (pending) return getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.saving');
  return editing
    ? getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.saveChanges')
    : createLabel;
}

function searchStatus(searching: boolean, failed: boolean, es: boolean): string {
  if (searching) return getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.searching');
  return failed
    ? getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.couldNotLoadFoods')
    : getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.noFoodsFound');
}

const maxEntryAmount = 999999.99;
const roundedAmount = (value: string) => Math.round(Number(value) * 100) / 100;
const validAmount = (value: string) =>
  roundedAmount(value) > 0 && roundedAmount(value) <= maxEntryAmount;

const entityTypes = ['Food', 'Recipe'] as const;
type EntityType = (typeof entityTypes)[number];
type CatalogueForm = { kind: 'create'; type: EntityType } | { kind: 'edit'; entry: EntrySource };

function catalogueTypeLabel(label: EntityType, es: boolean) {
  if (!es) return label;
  return label === 'Food' ? 'Alimentos' : 'Recetas';
}

function queueReviewTitle(count: number, es: boolean) {
  const noun =
    count === 1
      ? getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.entry')
      : getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.entries');
  return `${getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.review')} ${count} ${noun}`;
}

function catalogueFormTitle(editing: boolean, type: EntityType, es: boolean) {
  const action = editing
    ? getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.edit')
    : getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.create');
  const item =
    type === 'Food'
      ? getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.food')
      : getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.recipe');
  return `${action} ${item}`;
}

function recipePortionLabel(servings: number, es: boolean) {
  if (es) return servings === 1 ? 'Por ración' : `Para ${servings} raciones`;
  return servings === 1 ? 'Per serving' : `For ${servings} servings`;
}

function catalogueLoadingLabel(collection: 'foods' | 'recipes', es: boolean) {
  if (es) return collection === 'foods' ? 'Cargando alimentos' : 'Cargando recetas';
  return `Loading ${collection}`;
}

function catalogueRetryLabel(collection: 'foods' | 'recipes', es: boolean) {
  if (es)
    return collection === 'foods' ? 'Reintentar carga de alimentos' : 'Reintentar carga de recetas';
  return `Retry loading ${collection}`;
}

function quantityUnitLabel(amount: number, unit: string, es: boolean) {
  if (es && unit !== 'g') return amount === 1 ? 'ración' : 'raciones';
  return unit;
}

function reviewItemEditLabel(editing: boolean, name: string, es: boolean) {
  if (es) return `${editing ? 'Cancelar edición de la cantidad de' : 'Editar cantidad de'} ${name}`;
  return `${editing ? 'Cancel editing' : 'Edit'} ${name} quantity`;
}

function reviewConfirmLabel(pending: boolean, count: number, meal: string, es: boolean) {
  if (pending) return getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.adding');
  if (es) return `Añadir ${count} ${count === 1 ? 'registro' : 'registros'}`;
  return `Add ${count} ${count === 1 ? 'entry' : 'entries'} to ${meal}`;
}

function portionForAmount(amount: number, unit: string, es: boolean) {
  const isServing = unit === 'servings' || unit === 'serving';
  if (!isServing)
    return `${getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.for')} ${amount} ${unit}`;
  const portionUnit =
    amount === 1
      ? getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.serving')
      : getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.servings');
  return `${getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.for')} ${amount} ${portionUnit}`;
}

function amountActionLabel(adding: boolean, label: string, es: boolean) {
  if (!es) return label;
  return getTranslation(adding ? 'es' : 'en')('nutrition.AddFoodScreen.guardarCambios');
}

function selectedFoodPortion(grams: number, es: boolean) {
  if (grams === 100) return getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.per100G');
  return getTranslation(es ? 'es' : 'en')('dynamicMessages.forG_283271', { value1: grams });
}

function foodFieldLabel(field: 'calories' | 'protein' | 'carbohydrates' | 'fats', es: boolean) {
  const labelsEs = {
    calories: 'Calorías',
    protein: 'Proteínas',
    carbohydrates: 'Carbohidratos',
    fats: 'Grasas',
  };
  const labelsEn = {
    calories: 'Calories',
    protein: 'Protein',
    carbohydrates: 'Carbohydrates',
    fats: 'Fat',
  };
  return (es ? labelsEs : labelsEn)[field];
}

const mealTypeFor = (meal: string) =>
  ({ Breakfast: 'breakfast', Lunch: 'lunch', Dinner: 'dinner', Snacks: 'snack' })[meal] as
    'breakfast' | 'lunch' | 'dinner' | 'snack';

function upsertQueuedEntry(current: QueuedEntry[], entry: QueuedEntry): QueuedEntry[] {
  if (!current.some((item) => entryKey(item) === entryKey(entry))) return [...current, entry];
  return current.map((item) => (entryKey(item) === entryKey(entry) ? entry : item));
}

async function submitQueuedEntries(entries: QueuedEntry[], date: string, meal: string) {
  const context = { date, meal_type: mealTypeFor(meal) };
  const results = await Promise.allSettled(
    entries.map(async (entry) => {
      if (entry.kind === 'food') {
        return nutritionApi.addMealItem({
          ...context,
          food_id: entry.source.id,
          quantity_grams: entry.amount,
        });
      }
      return nutritionApi.addRecipeMealItem({
        ...context,
        recipe_id: entry.source.id,
        servings: entry.amount,
      });
    }),
  );
  return entries.filter((_, index) => results[index].status === 'rejected');
}

function CatalogueHeader({
  meal,
  reviewingEntries,
  pending,
  tab,
  reduceMotion,
  onTabChange,
  onCreate,
  onBack,
}: Readonly<{
  meal: string;
  reviewingEntries: boolean;
  pending: boolean;
  tab: EntityType;
  reduceMotion: boolean;
  onTabChange: (tab: EntityType) => void;
  onCreate: () => void;
  onBack: () => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            reviewingEntries
              ? getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.backToSelection')
              : getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.backToNutrition')
          }
          disabled={pending}
          onPress={() => {
            onBack();
          }}
          style={[styles.back, !reviewingEntries && { backgroundColor: p['surface-300'] }]}
        >
          <Feather name="arrow-left" size={24} color={p.ink} />
        </Pressable>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={[textStyles['title-lg'], { color: p.ink }]}>
            {reviewingEntries
              ? getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.reviewEntries')
              : getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.addFood')}
          </Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            {es
              ? ((
                  {
                    Breakfast: 'Desayuno',
                    Lunch: 'Comida',
                    Dinner: 'Cena',
                    Snacks: 'Tentempiés',
                  } as Record<string, string>
                )[meal] ?? meal)
              : meal}
          </Text>
        </View>
        {!reviewingEntries ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.create')}
            onPress={() => onCreate()}
            style={[styles.createButton, { backgroundColor: p['brand-soft'] }]}
          >
            <Feather name="plus" size={20} color={p['brand-ink']} />
            <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
              {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.create')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {!reviewingEntries ? (
        <View
          accessibilityRole="tablist"
          accessibilityLabel={getTranslation(es ? 'es' : 'en')(
            'nutrition.AddFoodScreen.catalogueType',
          )}
          style={styles.header}
        >
          {entityTypes.map((label) => (
            <AnimatedTextSelector
              key={label}
              label={catalogueTypeLabel(label, es)}
              selected={tab === label}
              role="tab"
              reduceMotion={reduceMotion}
              onPress={() => onTabChange(label)}
              equalWidth
            />
          ))}
        </View>
      ) : null}
    </>
  );
}

function FoodCatalogueList({
  active,
  foodList,
  results,
  visibleFoodSearch,
  debouncedSearch,
  queuedEntries,
  accountId,
  onSelect,
  onEdit,
  onRequestDelete,
}: Readonly<{
  active: boolean;
  foodList: React.RefObject<FlatList<Food> | null>;
  results: ReturnType<typeof useFoodCatalogue>;
  visibleFoodSearch: boolean;
  debouncedSearch: string;
  queuedEntries: QueuedEntry[];
  accountId: number;
  onSelect: (food: Food) => void;
  onEdit: (food: Food) => void;
  onRequestDelete: (food: Food) => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <>
      {active ? (
        <FlatList
          ref={foodList}
          testID="food-catalogue"
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          data={visibleFoodSearch ? results.items : []}
          initialNumToRender={20}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <FoodRow
              food={item}
              isQueued={queuedEntries.some(
                (entry) => entry.kind === 'food' && entry.source.id === item.id,
              )}
              onSelect={onSelect}
              accountId={accountId}
              onEdit={onEdit}
              onRequestDelete={onRequestDelete}
            />
          )}
          ListEmptyComponent={
            (visibleFoodSearch && debouncedSearch && !results.isPending && !results.isError ? (
              <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
                {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.noFoodsFound2')}
              </Text>
            ) : null) ?? undefined
          }
          ListFooterComponent={
            (visibleFoodSearch ? (
              <CatalogueStatus catalogue={results} collection="foods" />
            ) : null) ?? undefined
          }
          onEndReachedThreshold={0.5}
          onEndReached={results.loadMore}
        />
      ) : null}
    </>
  );
}

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
  const es = useLanguage() === 'es';
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [tab, setTab] = React.useState<EntityType>('Food');
  const [form, setForm] = React.useState<CatalogueForm | null>(null);
  const [portion, setPortion] = React.useState<EntrySource | null>(null);
  const [reduceMotion, setReduceMotion] = React.useState(true);
  React.useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [foodToDelete, setFoodToDelete] = React.useState<Food | null>(null);
  const [queuedEntries, setQueuedEntries] = React.useState<QueuedEntry[]>([]);
  const [reviewingEntries, setReviewingEntries] = React.useState(false);
  const modalOpen = form !== null || portion !== null || foodToDelete !== null;
  const openPortion = (entry: EntrySource) => {
    Keyboard.dismiss();
    setPortion(entry);
  };
  const openForm = (next: CatalogueForm) => {
    Keyboard.dismiss();
    setForm(next);
  };
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const visibleFoodSearch = search.trim() === debouncedSearch;
  const results = useFoodCatalogue(
    debouncedSearch,
    tab === 'Food' && !reviewingEntries && visibleFoodSearch,
  );
  const foodList = React.useRef<FlatList<Food>>(null);
  const saveQueue = useMutation({
    mutationFn: async () => {
      const failed = await submitQueuedEntries(queuedEntries, date, meal);
      setQueuedEntries(failed);
      if (failed.length < queuedEntries.length) onSaved();
      if (failed.length) throw new Error('Some entries could not be added.');
    },
    onSuccess: onClose,
  });
  const queueEntry = (entry: QueuedEntry) => {
    setQueuedEntries((current) => upsertQueuedEntry(current, entry));
  };
  const removeFood = useMutation({
    mutationFn: (foodId: number) => nutritionApi.deleteFood(foodId),
    onSuccess: () => {
      setFoodToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['nutrition', 'foods'] });
    },
  });
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p['surface-100'] }]}>
      <View
        aria-hidden={modalOpen}
        accessibilityElementsHidden={modalOpen}
        importantForAccessibility={modalOpen ? 'no-hide-descendants' : 'auto'}
        style={styles.screen}
      >
        <View style={styles.content}>
          <CatalogueHeader
            meal={meal}
            reviewingEntries={reviewingEntries}
            pending={saveQueue.isPending}
            tab={tab}
            reduceMotion={reduceMotion}
            onTabChange={setTab}
            onCreate={() => openForm({ kind: 'create', type: tab })}
            onBack={() => {
              if (reviewingEntries) {
                saveQueue.reset();
                setReviewingEntries(false);
              } else onClose();
            }}
          />
          {tab === 'Food' && !reviewingEntries ? (
            <>
              <Text style={[textStyles.label, { color: p.ink }]}>
                {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.search')}
              </Text>
              <TextField
                accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                  'nutrition.AddFoodScreen.searchFood',
                )}
                maxLength={150}
                leading={<Feather name="search" size={20} color={p['ink-muted']} />}
                value={search}
                onChangeText={(value) => {
                  setSearch(value);
                  foodList.current?.scrollToOffset({ offset: 0, animated: false });
                }}
                placeholder={getTranslation(es ? 'es' : 'en')(
                  'nutrition.AddFoodScreen.chickenRiceYogurt',
                )}
              />
            </>
          ) : null}
          <View style={tab === 'Recipe' && !reviewingEntries ? styles.list : styles.hidden}>
            <RecipePicker
              active={tab === 'Recipe' && !reviewingEntries}
              queuedRecipeIds={queuedEntries
                .filter((item) => item.kind === 'recipe')
                .map((item) => item.source.id)}
              onSelect={(recipe) => openPortion({ kind: 'recipe', source: recipe })}
              onEdit={(recipe) =>
                openForm({ kind: 'edit', entry: { kind: 'recipe', source: recipe } })
              }
              accountId={accountId}
            />
          </View>
          {reviewingEntries ? (
            <ScrollView
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.reviewContent}
            >
              <EntryQueueReview
                meal={meal}
                entries={queuedEntries}
                pending={saveQueue.isPending}
                error={saveQueue.isError}
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
            </ScrollView>
          ) : null}
          <FoodCatalogueList
            active={tab === 'Food' && !reviewingEntries}
            foodList={foodList}
            results={results}
            visibleFoodSearch={visibleFoodSearch}
            debouncedSearch={debouncedSearch}
            queuedEntries={queuedEntries}
            accountId={accountId}
            onSelect={(food) => openPortion({ kind: 'food', source: food })}
            onEdit={(food) => openForm({ kind: 'edit', entry: { kind: 'food', source: food } })}
            onRequestDelete={(food) => {
              removeFood.reset();
              setFoodToDelete(food);
            }}
          />
        </View>
        {!reviewingEntries && queuedEntries.length > 0 ? (
          <View style={styles.reviewFooter}>
            <Button
              title={queueReviewTitle(queuedEntries.length, es)}
              icon="clipboard"
              onPress={() => setReviewingEntries(true)}
            />
          </View>
        ) : null}
      </View>
      <DeleteFoodConfirmation
        food={foodToDelete}
        error={removeFood.isError}
        pending={removeFood.isPending}
        onCancel={() => setFoodToDelete(null)}
        onConfirm={() => {
          if (foodToDelete) removeFood.mutate(foodToDelete.id);
        }}
      />
      {portion ? (
        <PortionPicker
          entry={portion}
          reduceMotion={reduceMotion}
          onClose={() => setPortion(null)}
          onQueue={(amount) => {
            queueEntry({ ...portion, amount });
            setPortion(null);
          }}
        />
      ) : null}
      {form ? (
        <CatalogueFormModal
          accountId={accountId}
          form={form}
          reduceMotion={reduceMotion}
          onChangeType={(type) => setForm({ kind: 'create', type })}
          onClose={() => setForm(null)}
          onSaved={(entry) => {
            setQueuedEntries((current) =>
              current.map((item) =>
                entryKey(item) === entryKey(entry) ? { ...entry, amount: item.amount } : item,
              ),
            );
            setForm(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function CatalogueFormModal({
  accountId,
  form,
  reduceMotion,
  onChangeType,
  onClose,
  onSaved,
}: Readonly<{
  accountId: number;
  form: CatalogueForm;
  reduceMotion: boolean;
  onChangeType: (type: EntityType) => void;
  onClose: () => void;
  onSaved: (entry: EntrySource) => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const scroll = React.useRef<ScrollViewInstance>(null);
  const editing = form.kind === 'edit';
  let type: EntityType;
  if (form.kind === 'edit') type = form.entry.kind === 'food' ? 'Food' : 'Recipe';
  else type = form.type;
  return (
    <Modal animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}
      >
        <SafeAreaView
          edges={['top', 'bottom', 'left', 'right']}
          accessibilityViewIsModal
          style={[styles.catalogueForm, { backgroundColor: p['surface-200'] }]}
        >
          <View style={styles.header}>
            <Text
              accessibilityRole="header"
              style={[textStyles['title-md'], styles.heading, { color: p.ink }]}
            >
              {catalogueFormTitle(editing, type, es)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                editing
                  ? getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.closeEditor')
                  : getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.closeCreation')
              }
              onPress={onClose}
              style={[styles.back, { backgroundColor: p['surface-300'] }]}
            >
              <Feather name="x" size={24} color={p.ink} />
            </Pressable>
          </View>
          {!editing ? (
            <View
              accessibilityRole="tablist"
              accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                'nutrition.AddFoodScreen.creationType',
              )}
              style={styles.header}
            >
              {entityTypes.map((label) => (
                <AnimatedTextSelector
                  key={label}
                  label={catalogueTypeLabel(label, es)}
                  selected={type === label}
                  role="tab"
                  reduceMotion={reduceMotion}
                  onPress={() => {
                    if (type === label) return;
                    onChangeType(label);
                    scroll.current?.scrollTo({ y: 0, animated: false });
                  }}
                  equalWidth
                />
              ))}
            </View>
          ) : null}
          <ScrollView
            ref={scroll}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.recipeForm}
          >
            <CatalogueEditors accountId={accountId} form={form} type={type} onSaved={onSaved} />
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CatalogueEditors({
  accountId,
  form,
  type,
  onSaved,
}: Readonly<{
  accountId: number;
  form: CatalogueForm;
  type: EntityType;
  onSaved: (entry: EntrySource) => void;
}>) {
  const editing = form.kind === 'edit';
  return (
    <>
      {!editing || type === 'Food' ? (
        <View style={type === 'Food' ? undefined : styles.hidden}>
          <FoodEditor
            food={editing && form.entry.kind === 'food' ? form.entry.source : null}
            onSaved={(source) => onSaved({ kind: 'food', source })}
          />
        </View>
      ) : null}
      {!editing || type === 'Recipe' ? (
        <View style={type === 'Recipe' ? undefined : styles.hidden}>
          <RecipeEditor
            accountId={accountId}
            recipe={editing && form.entry.kind === 'recipe' ? form.entry.source : null}
            onSaved={(source) => onSaved({ kind: 'recipe', source })}
          />
        </View>
      ) : null}
    </>
  );
}

function PortionPicker({
  entry,
  reduceMotion,
  onClose,
  onQueue,
}: Readonly<{
  entry: EntrySource;
  reduceMotion: boolean;
  onClose: () => void;
  onQueue: (amount: number) => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const [amount, setAmount] = React.useState(entry.kind === 'recipe' ? '1' : '');
  const [previewAmount, setPreviewAmount] = React.useState('');
  React.useEffect(() => {
    if (entry.kind !== 'food') return;
    const timer = setTimeout(() => setPreviewAmount(amount), 250);
    return () => clearTimeout(timer);
  }, [amount, entry.kind]);
  const canQueue = validAmount(amount);
  const previewServings = canQueue ? roundedAmount(amount) : 1;
  const submit = () => {
    if (canQueue) onQueue(roundedAmount(amount));
  };

  return (
    <Modal transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.screen, { backgroundColor: p.scrim }]}
      >
        <SafeAreaView style={[styles.screen, styles.modalBackdrop]}>
          <View
            accessibilityViewIsModal
            style={[styles.portionDialog, { backgroundColor: p['surface-200'] }]}
          >
            <View style={styles.header}>
              <Text
                accessibilityRole="header"
                style={[textStyles['title-md'], styles.heading, { color: p.ink }]}
              >
                {entry.source.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                  'nutrition.AddFoodScreen.closeAmountSelector',
                )}
                onPress={onClose}
                style={styles.back}
              >
                <Feather name="x" size={24} color={p.ink} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.portionScroll}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.recipeForm}
            >
              {entry.kind === 'food' ? (
                <>
                  <SelectedFoodPreview food={entry.source} amount={previewAmount} />
                  <AmountActionRow
                    label="Add food"
                    amount={amount}
                    onChange={setAmount}
                    onPress={submit}
                  />
                </>
              ) : (
                <>
                  <PortionNutritionPreview
                    values={entry.source}
                    embedded
                    factor={previewServings}
                    portion={recipePortionLabel(previewServings, es)}
                  />
                  <Text style={[textStyles.label, { color: p.ink }]}>
                    {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.servings2')}
                  </Text>
                  <View style={[styles.amountRow, styles.portionRecipeRow]}>
                    <ServingsStepper
                      label={getTranslation(es ? 'es' : 'en')(
                        'nutrition.AddFoodScreen.recipeServingsToAdd',
                      )}
                      value={amount}
                      onChange={setAmount}
                      fractional
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                        'nutrition.AddFoodScreen.addRecipe',
                      )}
                      accessibilityState={{ disabled: !canQueue }}
                      disabled={!canQueue}
                      onPress={submit}
                      style={({ pressed }) => [
                        styles.queueRecipeButton,
                        {
                          backgroundColor: p['brand-soft'],
                          opacity: !canQueue || pressed ? 0.55 : 1,
                        },
                      ]}
                    >
                      <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
                        {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.add')}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CatalogueStatus({
  catalogue,
  collection,
}: Readonly<{
  catalogue: Pick<ReturnType<typeof useFoodCatalogue>, 'isError' | 'isFetchingNextPage' | 'retry'>;
  collection: 'foods' | 'recipes';
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  if (catalogue.isFetchingNextPage)
    return (
      <ActivityIndicator
        accessibilityLabel={catalogueLoadingLabel(collection, es)}
        color={p.brand}
      />
    );
  if (!catalogue.isError) return null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={catalogue.retry}
      style={[styles.pageAction, { backgroundColor: p['surface-300'] }]}
    >
      <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
        {catalogueRetryLabel(collection, es)}
      </Text>
    </Pressable>
  );
}

function FoodRow({
  food,
  isQueued,
  onSelect,
  accountId,
  onEdit,
  onRequestDelete,
}: Readonly<{
  food: Food;
  isQueued: boolean;
  onSelect: (food: Food) => void;
  accountId: number;
  onEdit: (food: Food) => void;
  onRequestDelete: (food: Food) => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <View style={[styles.catalogueRow, { backgroundColor: p['surface-200'] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={getTranslation(es ? 'es' : 'en')('dynamicMessages.select_617c5b', {
          value1: food.name,
        })}
        accessibilityState={{ selected: isQueued }}
        onPress={() => onSelect(food)}
        style={({ pressed }) => [styles.recipeSelect, { opacity: pressed ? 0.65 : 1 }]}
      >
        <View
          style={[
            styles.foodIcon,
            {
              backgroundColor: p['surface-300'],
              borderColor: isQueued ? p['brand-ink'] : 'transparent',
              borderWidth: 2,
            },
          ]}
        >
          <Feather name="coffee" size={22} color={p['brand-ink']} />
        </View>
        <View style={styles.flex}>
          <Text style={[textStyles.body, { color: p.ink }]}>{food.name}</Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.per100G')} · {food.calories}{' '}
            kcal
          </Text>
        </View>
      </Pressable>
      {food.user_id === accountId ? (
        <View style={styles.itemActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={getTranslation(es ? 'es' : 'en')('dynamicMessages.edit_a899b6', {
              value1: food.name,
            })}
            hitSlop={spacing['space-1']}
            onPress={() => onEdit(food)}
            style={styles.editItem}
          >
            <Feather name="edit-2" size={19} color={p['brand-ink']} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={getTranslation(es ? 'es' : 'en')('dynamicMessages.delete_602940', {
              value1: food.name,
            })}
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
  const es = useLanguage() === 'es';
  return (
    <Modal transparent animationType="fade" visible={Boolean(food)} onRequestClose={onCancel}>
      <View style={[styles.modalBackdrop, { backgroundColor: p.scrim }]}>
        <View
          accessibilityViewIsModal
          style={[styles.deleteConfirmation, { backgroundColor: p['surface-200'] }]}
        >
          <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
            {error
              ? getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.canTDeleteFood')
              : getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.deleteFood')}
          </Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            {error
              ? getTranslation(es ? 'es' : 'en')('dynamicMessages.isUsedInARecipeOr_364fe6', {
                  value1: food?.name,
                })
              : getTranslation(es ? 'es' : 'en')(
                  'dynamicMessages.deleteThisCannotBeUndone_b12a2e',
                  { value1: food?.name },
                )}
          </Text>
          <View style={styles.confirmationActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={[styles.confirmButton, { backgroundColor: p['surface-300'] }]}
            >
              <Text style={[textStyles.label, { color: p.ink }]}>
                {error
                  ? getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.close')
                  : getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.cancel')}
              </Text>
            </Pressable>
            {!error ? (
              <Pressable
                accessibilityRole="button"
                disabled={pending}
                onPress={onConfirm}
                style={[styles.confirmButton, { backgroundColor: p.danger }]}
              >
                <Text style={[textStyles.label, { color: p['on-brand'] }]}>
                  {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.delete')}
                </Text>
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
  onRemove,
  onUpdateAmount,
  onConfirm,
}: Readonly<{
  meal: string;
  entries: QueuedEntry[];
  pending: boolean;
  error: boolean;
  onRemove: (key: string) => void;
  onUpdateAmount: (key: string, amount: number) => void;
  onConfirm: () => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
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
  const confirmDisabled = pending || editingKey !== null || !entries.length;

  return (
    <View style={styles.reviewSections}>
      <View style={[styles.reviewList, { borderColor: p.line }]}>
        {entries.map((item) => {
          const key = entryKey(item);
          const editing = editingKey === key;
          const amount =
            editing && validAmount(draftQuantity) ? roundedAmount(draftQuantity) : item.amount;
          const unit = entryUnit(item.kind, amount);
          const factor = nutritionFactor({ ...item, amount });
          const calories = Math.round(item.source.calories * factor);
          return (
            <View key={key} style={[styles.reviewItem, { borderColor: p.line }]}>
              <View style={styles.queueRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={reviewItemEditLabel(editing, item.source.name, es)}
                  accessibilityState={{ disabled: pending, expanded: editing }}
                  disabled={pending}
                  onPress={() => {
                    setEditingKey(editing ? null : key);
                    setDraftQuantity(editing ? '' : String(item.amount));
                  }}
                  style={({ pressed }) => [styles.reviewItemEdit, { opacity: pressed ? 0.65 : 1 }]}
                >
                  <View style={styles.flex}>
                    <Text style={[textStyles.label, { color: p.ink }]}>{item.source.name}</Text>
                    <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                      {amount} {quantityUnitLabel(amount, unit, es)} · {calories} kcal
                    </Text>
                  </View>
                  <Feather
                    name={editing ? 'chevron-up' : 'edit-2'}
                    size={17}
                    color={p['ink-muted']}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                    'dynamicMessages.removeFromSelection_9fb4de',
                    { value1: item.source.name },
                  )}
                  disabled={pending}
                  onPress={() => {
                    if (editing) {
                      setEditingKey(null);
                      setDraftQuantity('');
                    }
                    onRemove(key);
                  }}
                  style={({ pressed }) => [styles.reviewRemove, { opacity: pressed ? 0.65 : 1 }]}
                >
                  <Feather name="x" size={20} color={p['ink-muted']} />
                </Pressable>
              </View>
              {editing ? (
                <>
                  <AmountActionRow
                    label="Save changes"
                    amount={draftQuantity}
                    unit={item.kind === 'food' ? 'g' : 'servings'}
                    onChange={setDraftQuantity}
                    onPress={() => {
                      onUpdateAmount(key, roundedAmount(draftQuantity));
                      setEditingKey(null);
                      setDraftQuantity('');
                    }}
                  />
                  <PortionNutritionPreview
                    values={item.source}
                    factor={factor}
                    portion={portionForAmount(amount, unit, es)}
                  />
                </>
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={styles.reviewTotals}>
        <Text style={[textStyles.label, { color: p.ink }]}>
          {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.selectionTotals')}
        </Text>
        <View
          accessible
          accessibilityLabel={
            es
              ? `Resumen nutricional: ${Math.round(totals.calories)} calorías, ${formatGrams(totals.carbohydrates)} gramos de carbohidratos, ${formatGrams(totals.protein)} gramos de proteínas, ${formatGrams(totals.fats)} gramos de grasas`
              : `Nutrition summary: ${Math.round(totals.calories)} calories, ${formatGrams(totals.carbohydrates)} grams carbohydrates, ${formatGrams(totals.protein)} grams protein, ${formatGrams(totals.fats)} grams fat`
          }
        >
          <NutritionSummary values={totals} precision={1} />
        </View>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
          {getTranslation(es ? 'es' : 'en')(
            'nutrition.AddFoodScreen.someEntriesCouldNotBeAddedReviewTheRemainingSelectionAndTryAgain',
          )}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: confirmDisabled }}
        disabled={confirmDisabled}
        onPress={onConfirm}
        style={({ pressed }) => [
          styles.reviewConfirm,
          { backgroundColor: p.brand, opacity: confirmDisabled || pressed ? 0.55 : 1 },
        ]}
      >
        <Text style={[textStyles.label, styles.centeredText, { color: p['on-brand'] }]}>
          {reviewConfirmLabel(pending, entries.length, meal, es)}
        </Text>
      </Pressable>
    </View>
  );
}

function AmountActionRow({
  amount,
  unit = 'g',
  label,
  onChange,
  onPress,
}: Readonly<{
  amount: string;
  unit?: 'g' | 'servings';
  label: 'Add food' | 'Save changes';
  onChange: (amount: string) => void;
  onPress: () => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const adding = label === 'Add food';
  return (
    <View style={styles.amountRow}>
      <TextField
        accessibilityLabel={
          unit === 'g'
            ? getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.foodAmount')
            : getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.recipeServingsToAdd')
        }
        keyboardType="decimal-pad"
        placeholder={getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.amount')}
        value={amount}
        onChangeText={(value) => onChange(numericAmount(value))}
        containerStyle={[styles.flex, styles.compactField]}
        inputStyle={styles.compactInput}
        trailing={
          <Text style={[textStyles.label, { color: p['ink-muted'] }]}>
            {es && unit === 'servings' ? 'raciones' : unit}
          </Text>
        }
      />
      <QueueIconButton
        label={amountActionLabel(adding, label, es)}
        icon={adding ? 'plus' : 'check'}
        disabled={!validAmount(amount)}
        onPress={onPress}
      />
    </View>
  );
}

function QueueIconButton({
  icon,
  label,
  disabled,
  onPress,
}: Readonly<{
  icon: 'plus' | 'check';
  label: string;
  disabled: boolean;
  onPress: () => void;
}>) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.queueIconButton,
        { backgroundColor: p['brand-soft'], opacity: disabled || pressed ? 0.55 : 1 },
      ]}
    >
      <Feather name={icon} size={22} color={p['brand-ink']} />
    </Pressable>
  );
}

function numericAmount(value: string) {
  const [integer, ...fraction] = value.replace(/[^0-9.]/g, '').split('.');
  return fraction.length ? `${integer}.${fraction.join('')}` : integer;
}

function SelectedFoodPreview({ food, amount }: Readonly<{ food: Food; amount: string }>) {
  const es = useLanguage() === 'es';
  const quantity = Number(amount);
  const grams = Number.isFinite(quantity) && quantity > 0 ? quantity : 100;
  return (
    <PortionNutritionPreview
      values={food}
      embedded
      factor={grams / 100}
      portion={selectedFoodPortion(grams, es)}
    />
  );
}

function formatGrams(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}

function EmptyRecipes({ searching }: Readonly<{ searching: boolean }>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  if (searching)
    return (
      <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
        {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.noRecipesFound')}
      </Text>
    );
  return (
    <View style={styles.emptyRecipes}>
      <Feather name="book-open" size={22} color={p['ink-muted']} />
      <Text style={[textStyles.body, { color: p.ink }]}>
        {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.noRecipesSavedYet')}
      </Text>
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        {getTranslation(es ? 'es' : 'en')(
          'nutrition.AddFoodScreen.createOneToAddItsServingsToAnyMeal',
        )}
      </Text>
    </View>
  );
}

function RecipePicker({
  accountId,
  active,
  queuedRecipeIds,
  onSelect,
  onEdit,
}: Readonly<{
  accountId: number;
  active: boolean;
  queuedRecipeIds: number[];
  onSelect: (recipe: Recipe) => void;
  onEdit: (recipe: Recipe) => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const queryClient = useQueryClient();
  const [recipeToDelete, setRecipeToDelete] = React.useState<Recipe | null>(null);
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const visibleSearch = search.trim() === debouncedSearch;
  const list = React.useRef<FlatList<Recipe>>(null);
  const recipes = useRecipeCatalogue(debouncedSearch, active && visibleSearch);
  const remove = useMutation({
    mutationFn: (recipeId: number) => nutritionApi.deleteRecipe(recipeId),
    onSuccess: () => {
      setRecipeToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['nutrition', 'recipes'] });
    },
  });
  return (
    <View style={[styles.list, styles.recipeForm]}>
      <Text style={[textStyles.label, { color: p.ink }]}>
        {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.search')}
      </Text>
      <TextField
        accessibilityLabel={getTranslation(es ? 'es' : 'en')(
          'nutrition.AddFoodScreen.searchRecipe',
        )}
        maxLength={150}
        leading={<Feather name="search" size={20} color={p['ink-muted']} />}
        value={search}
        onChangeText={(value) => {
          setSearch(value);
          list.current?.scrollToOffset({ offset: 0, animated: false });
        }}
        placeholder={getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.chickenRicePasta')}
      />
      <FlatList
        ref={list}
        testID="recipe-catalogue"
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        data={visibleSearch ? recipes.items : []}
        initialNumToRender={20}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item: recipe }) => (
          <View style={[styles.catalogueRow, { backgroundColor: p['surface-200'] }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                selected: queuedRecipeIds.includes(recipe.id),
              }}
              accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                'dynamicMessages.select_617c5b',
                { value1: recipe.name },
              )}
              onPress={() => onSelect(recipe)}
              style={({ pressed }) => [styles.recipeSelect, { opacity: pressed ? 0.65 : 1 }]}
            >
              <View
                style={[
                  styles.foodIcon,
                  {
                    backgroundColor: p['surface-300'],
                    borderColor: queuedRecipeIds.includes(recipe.id)
                      ? p['brand-ink']
                      : 'transparent',
                    borderWidth: 2,
                  },
                ]}
              >
                <Feather name="book-open" size={20} color={p['brand-ink']} />
              </View>
              <View style={styles.flex}>
                <Text style={[textStyles.body, { color: p.ink }]}>{recipe.name}</Text>
                <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                  {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.perServing')} ·{' '}
                  {recipe.calories.toFixed(0)} kcal
                </Text>
              </View>
            </Pressable>
            {recipe.user_id === accountId ? (
              <View style={styles.itemActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                    'dynamicMessages.edit_a899b6',
                    { value1: recipe.name },
                  )}
                  hitSlop={spacing['space-1']}
                  onPress={() => onEdit(recipe)}
                  style={styles.editItem}
                >
                  <Feather name="edit-2" size={19} color={p['brand-ink']} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                    'dynamicMessages.delete_602940',
                    { value1: recipe.name },
                  )}
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
        )}
        ListEmptyComponent={
          (visibleSearch && !recipes.isPending && !recipes.isError ? (
            <EmptyRecipes searching={Boolean(debouncedSearch)} />
          ) : null) ?? undefined
        }
        ListFooterComponent={
          (visibleSearch ? <CatalogueStatus catalogue={recipes} collection="recipes" /> : null) ??
          undefined
        }
        onEndReachedThreshold={0.5}
        onEndReached={recipes.loadMore}
      />
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
              {remove.isError
                ? getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.canTDeleteRecipe')
                : getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.deleteRecipe')}
            </Text>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              {remove.isError
                ? getTranslation(es ? 'es' : 'en')(
                    'dynamicMessages.isAlreadyLoggedInYourDiary_d15a58',
                    { value1: recipeToDelete?.name },
                  )
                : getTranslation(es ? 'es' : 'en')(
                    'dynamicMessages.willBePermanentlyRemoved_fede90',
                    { value1: recipeToDelete?.name },
                  )}
            </Text>
            <View style={styles.confirmationActions}>
              {remove.isError ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setRecipeToDelete(null)}
                  style={[styles.confirmButton, { backgroundColor: p['surface-300'] }]}
                >
                  <Text style={[textStyles.label, { color: p.ink }]}>
                    {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.close')}
                  </Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setRecipeToDelete(null)}
                    style={[styles.confirmButton, { backgroundColor: p['surface-300'] }]}
                  >
                    <Text style={[textStyles.label, { color: p.ink }]}>
                      {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.cancel')}
                    </Text>
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
                    <Text style={[textStyles.label, { color: p['on-brand'] }]}>
                      {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.delete')}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ServingsStepper({
  label,
  value,
  onChange,
  fractional = false,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  fractional?: boolean;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const count = fractional ? roundedAmount(value) || 0 : Number(value);
  const maximum = fractional ? maxEntryAmount : 100;
  const step = (change: -1 | 1) => {
    const decrement = change < 0;
    const disabled = decrement ? count <= 1 : count >= maximum;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          decrement
            ? getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.decreaseServings')
            : getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.increaseServings')
        }
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          const next = Math.min(maximum, Math.max(fractional ? 0.01 : 1, count + change));
          onChange(String(Math.round(next * 100) / 100));
        }}
        style={({ pressed }) => [
          styles.stepperButton,
          { backgroundColor: p['surface-300'], opacity: disabled || pressed ? 0.55 : 1 },
        ]}
      >
        <Feather name={decrement ? 'minus' : 'plus'} size={18} color={p.ink} />
      </Pressable>
    );
  };

  return (
    <>
      {step(-1)}
      <TextField
        accessibilityLabel={label}
        keyboardType={fractional ? 'decimal-pad' : 'number-pad'}
        maxLength={fractional ? undefined : 3}
        value={value}
        onChangeText={(text) =>
          onChange(fractional ? numericAmount(text) : text.replace(/\D/g, ''))
        }
        containerStyle={[
          styles.compactField,
          styles.servingField,
          fractional && styles.fractionalServingField,
        ]}
        inputStyle={[styles.compactInput, styles.servingInput]}
      />
      {step(1)}
    </>
  );
}

function FoodEditor({
  food,
  onSaved,
}: Readonly<{ food: Food | null; onSaved: (food: Food) => void }>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
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
      <Text style={[textStyles.label, { color: p.ink }]}>
        {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.name')}
      </Text>
      <TextField
        accessibilityLabel={getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.foodName')}
        value={name}
        onChangeText={setName}
        placeholder={getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.greekYogurt')}
      />
      {(['calories', 'protein', 'carbohydrates', 'fats'] as const).map((field) => (
        <View key={field} style={styles.foodField}>
          <Text style={[textStyles.label, { color: p.ink }]}>{foodFieldLabel(field, es)}</Text>
          <TextField
            accessibilityLabel={
              es
                ? {
                    calories: 'Calorías',
                    protein: 'Proteínas',
                    carbohydrates: 'Carbohidratos',
                    fats: 'Grasas',
                  }[field]
                : field
            }
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
        <Text style={[textStyles['body-sm'], { color: p.danger }]}>
          {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.couldNotSaveFood')}
        </Text>
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
          {saveLabel(
            save.isPending,
            Boolean(food),
            getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.saveFood'),
            es,
          )}
        </Text>
      </Pressable>
    </View>
  );
}

type RecipeIngredient = {
  key: number;
  food: Pick<Food, 'id' | 'name'>;
  grams: string;
  nutrition: NutritionValues | null;
};

type IngredientWithNutrition = Omit<RecipeIngredient, 'nutrition'> & {
  nutrition: NutritionValues | null | undefined;
};

function recipeNutrition(ingredients: IngredientWithNutrition[]): NutritionValues {
  const totals: NutritionValues = { calories: 0, protein: 0, carbohydrates: 0, fats: 0 };
  for (const { nutrition, grams } of ingredients) {
    if (!nutrition) continue;
    const factor = Number(grams) / 100;
    totals.calories += nutrition.calories * factor;
    totals.protein += nutrition.protein * factor;
    totals.carbohydrates += nutrition.carbohydrates * factor;
    totals.fats += nutrition.fats * factor;
  }
  return totals;
}

function matchesRecipe(
  recipe: Recipe | null,
  servings: number,
  ingredients: RecipeIngredient[],
): boolean {
  return Boolean(
    recipe?.servings === servings &&
    recipe.ingredients.length === ingredients.length &&
    recipe.ingredients.every(
      (item, index) =>
        item.food_id === ingredients[index].food.id &&
        item.quantity_grams === Number(ingredients[index].grams),
    ),
  );
}

function RecipeIngredients({
  ingredientsWithNutrition,
  setIngredients,
}: Readonly<{
  ingredientsWithNutrition: IngredientWithNutrition[];
  setIngredients: React.Dispatch<React.SetStateAction<RecipeIngredient[]>>;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <>
      {ingredientsWithNutrition.length ? (
        <View style={styles.recipeFields}>
          <Text accessibilityRole="header" style={[textStyles.label, { color: p.ink }]}>
            {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.inThisRecipe')}
          </Text>
          <View style={[styles.ingredientList, { backgroundColor: p['surface-100'] }]}>
            {ingredientsWithNutrition.map(({ key, food, grams, nutrition }, index) => (
              <View
                key={key}
                style={[
                  styles.ingredientRow,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.line },
                ]}
              >
                <View style={styles.ingredientInfo}>
                  <Text style={[textStyles.body, { color: p.ink }]}>{food.name}</Text>
                  {nutrition && Number.isFinite(Number(grams)) && Number(grams) > 0 ? (
                    <NutritionSummary
                      values={nutrition}
                      factor={Number(grams) / 100}
                      precision={2}
                      compact
                    />
                  ) : null}
                </View>
                <View style={styles.ingredientControls}>
                  <TextField
                    accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                      'dynamicMessages.quantity_58e1cb',
                      { value1: food.name },
                    )}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    value={grams}
                    onChangeText={(value) =>
                      setIngredients((current) =>
                        current.map((ingredient) =>
                          ingredient.key === key
                            ? { ...ingredient, grams: numericAmount(value) }
                            : ingredient,
                        ),
                      )
                    }
                    containerStyle={[styles.compactField, styles.ingredientQuantity]}
                    inputStyle={[styles.compactInput, styles.amountInput]}
                    trailing={
                      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>g</Text>
                    }
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                      'dynamicMessages.remove_dcff76',
                      { value1: food.name },
                    )}
                    style={styles.stepperButton}
                    onPress={() =>
                      setIngredients((current) => current.filter((item) => item.key !== key))
                    }
                  >
                    <Feather name="x" size={18} color={p['ink-muted']} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}

function IngredientSearchResults({
  term,
  debouncedSearch,
  results,
  chooseIngredient,
}: Readonly<{
  term: string;
  debouncedSearch: string;
  results: ReturnType<typeof useFoodCatalogue>;
  chooseIngredient: (food: Food) => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <>
      {term ? (
        <ScrollView
          style={[styles.ingredientResults, { backgroundColor: p['surface-100'] }]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          accessibilityLabel={getTranslation(es ? 'es' : 'en')(
            'nutrition.AddFoodScreen.ingredientSearchResults',
          )}
          scrollEventThrottle={32}
          onScroll={({ nativeEvent: { contentSize, contentOffset, layoutMeasurement } }) => {
            if (contentSize.height - contentOffset.y <= layoutMeasurement.height * 1.5) {
              results.loadMore();
            }
          }}
        >
          {term === debouncedSearch && results.items.length ? (
            results.items.map((food) => (
              <Pressable
                key={food.id}
                accessibilityRole="button"
                accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                  'dynamicMessages.addAsAnIngredient_1b1f8a',
                  { value1: food.name },
                )}
                onPress={() => chooseIngredient(food)}
                style={({ pressed }) => [
                  styles.ingredientSearchRow,
                  { borderColor: p.line, backgroundColor: p['surface-200'] },
                  pressed && { backgroundColor: p['surface-300'] },
                ]}
              >
                <Text style={[textStyles.body, styles.flex, { color: p.ink }]}>{food.name}</Text>
                <View style={[styles.ingredientAddIcon, { backgroundColor: p['brand-soft'] }]}>
                  <Feather name="plus" size={18} color={p['brand-ink']} />
                </View>
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
              {searchStatus(term !== debouncedSearch || results.isPending, results.isError, es)}
            </Text>
          )}
          {term === debouncedSearch ? (
            <CatalogueStatus catalogue={results} collection="foods" />
          ) : null}
        </ScrollView>
      ) : null}
    </>
  );
}

function RecipeEditor({
  accountId,
  recipe,
  onSaved,
}: Readonly<{ accountId: number; recipe: Recipe | null; onSaved: (recipe: Recipe) => void }>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
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
  const [ingredients, setIngredients] = React.useState<RecipeIngredient[]>(
    recipe?.ingredients.map((ingredient, index) => ({
      key: index,
      food: { id: ingredient.food_id, name: ingredient.name },
      grams: ingredient.quantity_grams.toString(),
      nutrition: null,
    })) ?? [],
  );
  const existingFoodIds = [
    ...new Set(ingredients.filter((item) => !item.nutrition).map((item) => item.food.id)),
  ];
  const existingFoods = useQueries({
    queries: existingFoodIds.map((id) => ({
      queryKey: ['nutrition', 'foods', 'detail', accountId, id],
      queryFn: ({ signal }) => nutritionApi.food(id, signal),
    })),
  });
  const nutritionById = new Map(
    existingFoodIds.map((id, index) => [id, existingFoods[index].data]),
  );
  const ingredientsWithNutrition = ingredients.map((item) => ({
    ...item,
    nutrition: item.nutrition ?? nutritionById.get(item.food.id),
  }));
  const nextIngredientKey = React.useRef(ingredients.length);
  const clearIngredientSearch = () => {
    setSearch('');
    setDebouncedSearch('');
  };
  const chooseIngredient = (food: Food) => {
    const key = nextIngredientKey.current++;
    setIngredients((current) => [...current, { key, food, grams: '100', nutrition: food }]);
    clearIngredientSearch();
  };
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
  const showEstimate =
    validServings && validQuantities && ingredientsWithNutrition.every((item) => item.nutrition);
  const matchesSavedPortions = matchesRecipe(recipe, servingCount, ingredients);
  let preview = showEstimate ? recipeNutrition(ingredientsWithNutrition) : null;
  if (matchesSavedPortions) preview = recipe;

  return (
    <View style={styles.recipeForm}>
      <View style={styles.recipeFields}>
        <Text style={[textStyles.label, { color: p.ink }]}>
          {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.recipeName')}
        </Text>
        <TextField
          accessibilityLabel={getTranslation(es ? 'es' : 'en')(
            'nutrition.AddFoodScreen.recipeName',
          )}
          value={name}
          onChangeText={setName}
          placeholder={getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.chickenRiceBowl')}
          containerStyle={styles.compactField}
          inputStyle={styles.compactInput}
        />
        <View style={styles.servingRow}>
          <Text style={[textStyles.label, styles.flex, { color: p.ink }]}>
            {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.servings2')}
          </Text>
          <ServingsStepper
            label={getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.recipeServings')}
            value={servings}
            onChange={setServings}
          />
        </View>
      </View>
      <View style={styles.recipeFields}>
        <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
          {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.addIngredients')}
        </Text>
        <TextField
          accessibilityLabel={getTranslation(es ? 'es' : 'en')(
            'nutrition.AddFoodScreen.searchIngredient',
          )}
          maxLength={150}
          leading={<Feather name="search" size={18} color={p['ink-muted']} />}
          value={search}
          onChangeText={setSearch}
          placeholder={getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.searchForAFood')}
          trailing={
            search ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                  'nutrition.AddFoodScreen.clearIngredientSearch',
                )}
                onPress={clearIngredientSearch}
                style={styles.stepperButton}
              >
                <Feather name="x" size={18} color={p['ink-muted']} />
              </Pressable>
            ) : null
          }
          containerStyle={[styles.compactField, styles.ingredientSearchField]}
          inputStyle={styles.compactInput}
        />
      </View>
      <IngredientSearchResults
        term={term}
        debouncedSearch={debouncedSearch}
        results={results}
        chooseIngredient={chooseIngredient}
      />
      <RecipeIngredients
        ingredientsWithNutrition={ingredientsWithNutrition}
        setIngredients={setIngredients}
      />
      {preview ? (
        <View style={[styles.recipeNutrition, { borderColor: p.line }]}>
          <PortionNutritionPreview
            values={preview}
            factor={matchesSavedPortions ? 1 : 1 / servingCount}
            portion={getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.perServing')}
            precision={2}
            embedded
          />
        </View>
      ) : null}
      {!preview &&
      validServings &&
      validQuantities &&
      existingFoods.some((result) => result.isError) ? (
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {getTranslation(es ? 'es' : 'en')(
            'nutrition.AddFoodScreen.nutritionIsUnavailableForOneOrMoreIngredients',
          )}
        </Text>
      ) : null}
      {save.isError ? (
        <Text style={[textStyles['body-sm'], { color: p.danger }]}>
          {getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.couldNotSaveRecipe')}
        </Text>
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
          {saveLabel(
            save.isPending,
            Boolean(recipe),
            getTranslation(es ? 'es' : 'en')('nutrition.AddFoodScreen.createRecipe'),
            es,
          )}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { display: 'none' },
  screen: { flex: 1 },
  list: { flex: 1, minHeight: 0 },
  listContent: { paddingBottom: spacing['space-4'] },
  reviewFooter: { padding: spacing['space-4'] },
  content: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: spacing['space-4'],
    paddingTop: spacing['space-4'],
    gap: spacing['space-3'],
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
  reviewContent: { gap: spacing['space-5'], paddingBottom: spacing['space-5'] },
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
  catalogueForm: {
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
  fractionalServingField: { width: 88, minWidth: 60, flexShrink: 1 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-3'] },
  portionDialog: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '100%',
    borderRadius: radii['radius-md'],
    padding: spacing['space-3'],
    gap: spacing['space-2'],
  },
  portionScroll: { flexGrow: 0, flexShrink: 1 },
  portionRecipeRow: { justifyContent: 'space-between', gap: spacing['space-2'] },
  queueRecipeButton: {
    minWidth: sizes['tap-min'],
    minHeight: sizes['tap-min'],
    paddingHorizontal: spacing['space-2'],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii['radius-md'],
  },
  queueIconButton: {
    width: sizes['tap-min'],
    minHeight: sizes['tap-min'],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii['radius-md'],
  },
  servingInput: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  stepperButton: {
    width: sizes['tap-min'],
    minHeight: sizes['tap-min'],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii['radius-md'],
  },
  ingredientQuantity: {
    width: 64,
    paddingHorizontal: spacing['space-1'],
    gap: spacing['space-1'],
  },
  amountInput: { textAlign: 'right', textAlignVertical: 'center', fontVariant: ['tabular-nums'] },
  recipeNutrition: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing['space-3'],
  },
  ingredientSearchField: { paddingRight: spacing['space-1'] },
  ingredientResults: {
    maxHeight: 3 * sizes['control-height'],
    flexGrow: 0,
    flexShrink: 0,
    borderRadius: radii['radius-md'],
  },
  ingredientSearchHint: { padding: spacing['space-3'] },
  ingredientSearchRow: {
    paddingHorizontal: spacing['space-3'],
    minHeight: sizes['control-height'],
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    gap: spacing['space-2'],
  },
  ingredientAddIcon: {
    width: spacing['space-8'],
    height: spacing['space-8'],
    borderRadius: radii['radius-pill'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingredientList: { borderRadius: radii['radius-md'] },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingStart: spacing['space-2'],
    paddingVertical: spacing['space-2'],
    gap: spacing['space-1'] / 2,
  },
  ingredientInfo: { flex: 1, minWidth: 0, gap: spacing['space-1'] },
  ingredientControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catalogueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing['space-4'],
    borderRadius: radii['radius-lg'],
  },
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
  reviewSections: { gap: spacing['space-5'] },
  reviewList: { borderTopWidth: StyleSheet.hairlineWidth },
  reviewItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing['space-2'],
    gap: spacing['space-2'],
  },
  queueRow: { flexDirection: 'row', alignItems: 'center' },
  reviewItemEdit: {
    flex: 1,
    minHeight: sizes['tap-min'],
    flexDirection: 'row',
    gap: spacing['space-2'],
    alignItems: 'center',
  },
  reviewRemove: {
    width: sizes['tap-min'],
    minHeight: sizes['tap-min'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewTotals: { gap: spacing['space-2'] },
  reviewConfirm: {
    minHeight: sizes['control-height'],
    padding: spacing['space-3'],
    borderRadius: radii['radius-md'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredText: { textAlign: 'center' },
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
  add: {
    minHeight: sizes['control-height'],
    marginTop: spacing['space-3'],
    borderRadius: radii['radius-pill'],
    justifyContent: 'center',
    alignItems: 'center',
  },
});
