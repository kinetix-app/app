import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { nutritionApi } from './api';
import type { Food } from './schemas';

export function AddFoodScreen({
  meal,
  onClose,
  onSaved,
}: {
  meal: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const p = usePalette();
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Food | null>(null);
  const [amount, setAmount] = React.useState('200');
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const results = useQuery({
    queryKey: ['nutrition', 'foods', debouncedSearch],
    enabled: Boolean(debouncedSearch),
    queryFn: ({ signal }) => nutritionApi.searchFoods(debouncedSearch, signal),
  });
  const save = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Select a food first.');
      return nutritionApi.addMealItem({
        date: '2026-10-22',
        meal_type: (
          { Breakfast: 'breakfast', Lunch: 'lunch', Dinner: 'dinner', Snacks: 'snack' } as const
        )[meal as 'Breakfast'],
        food_id: selected.id,
        quantity_grams: Math.round(Number(amount) * 100) / 100,
      });
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p['surface-100'] }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to nutrition"
            onPress={onClose}
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
        <Text style={[textStyles.label, { color: p.ink }]}>Search</Text>
        <View
          style={[
            styles.inputRow,
            { backgroundColor: p['surface-300'], borderColor: p['line-strong'] },
          ]}
        >
          <Feather name="search" size={20} color={p['ink-muted']} />
          <TextInput
            accessibilityLabel="Search food"
            value={search}
            onChangeText={setSearch}
            placeholder="Chicken, rice, yogurt…"
            placeholderTextColor={p['ink-muted']}
            style={[styles.input, { color: p.ink }]}
          />
        </View>
        <View style={styles.chips}>
          {['Food', 'Recipe', 'Supermarket'].map((label, index) => (
            <View
              key={label}
              style={[
                styles.chip,
                { backgroundColor: index === 0 ? p['brand-soft'] : p['surface-300'] },
              ]}
            >
              <Text style={[textStyles.label, { color: index === 0 ? p['brand-ink'] : p.ink }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        <View style={[styles.results, { backgroundColor: p['surface-200'] }]}>
          {results.data?.map((food, index) => (
            <React.Fragment key={food.name}>
              {index > 0 ? <View style={[styles.divider, { backgroundColor: p.line }]} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Select ${food.name}`}
                accessibilityState={{ selected: selected?.id === food.id }}
                onPress={() => setSelected(food)}
                style={({ pressed }) => [
                  styles.foodRow,
                  {
                    opacity: pressed ? 0.65 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.foodIcon,
                    {
                      backgroundColor: p['surface-300'],
                      borderColor: selected?.id === food.id ? p['brand-ink'] : 'transparent',
                      borderWidth: 2,
                    },
                  ]}
                >
                  <Feather name="coffee" size={22} color={p['brand-ink']} />
                </View>
                <View style={styles.flex}>
                  <Text style={[textStyles.body, { color: p.ink }]}>{food.name}</Text>
                  <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>Per 100 g</Text>
                </View>
                <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
                  {food.calories} kcal
                </Text>
              </Pressable>
            </React.Fragment>
          ))}
          {debouncedSearch && !results.isPending && !results.data?.length ? (
            <Text style={[textStyles.body, { color: p['ink-muted'] }]}>No foods found.</Text>
          ) : null}
        </View>
        {selected ? (
          <View style={[styles.preview, { backgroundColor: p['brand-soft'] }]}>
            <Text style={[textStyles['title-md'], { color: p.ink }]}>{selected.name}</Text>
            <View style={styles.macroRow}>
              {[
                [`${selected.protein} g`, 'Protein'],
                [`${selected.carbohydrates} g`, 'Carbs'],
                [`${selected.fats} g`, 'Fat'],
              ].map(([value, label]) => (
                <View key={label} style={styles.flex}>
                  <Text style={[textStyles['metric-md'], { color: p.ink }]}>{value}</Text>
                  <Text style={[textStyles.caption, { color: p['ink-muted'] }]}>{label}</Text>
                </View>
              ))}
            </View>
            <Text style={[textStyles.caption, { color: p['ink-muted'] }]}>Values per 100 g</Text>
          </View>
        ) : null}
        <Text style={[textStyles.label, { color: p.ink }]}>Amount</Text>
        <View
          style={[
            styles.inputRow,
            { backgroundColor: p['surface-300'], borderColor: p['line-strong'] },
          ]}
        >
          <TextInput
            accessibilityLabel="Food amount"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            style={[styles.input, { color: p.ink }]}
          />
          <Text style={[textStyles.label, { color: p['ink-muted'] }]}>g</Text>
        </View>
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          Total:{' '}
          {selected && Number(amount)
            ? ((selected.calories * Number(amount)) / 100).toFixed(0)
            : '—'}{' '}
          kcal
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !selected || save.isPending }}
          disabled={!selected || save.isPending}
          onPress={() => save.mutate()}
          style={[
            styles.add,
            { backgroundColor: p.brand, opacity: !selected || save.isPending ? 0.55 : 1 },
          ]}
        >
          <Text style={[textStyles.label, { color: p['on-brand'] }]}>
            {save.isPending ? 'Adding…' : `Add to ${meal}`}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
  inputRow: {
    minHeight: sizes['control-height'],
    borderWidth: 1,
    borderRadius: radii['radius-md'],
    paddingHorizontal: spacing['space-3'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-2'],
  },
  input: { flex: 1, ...textStyles.body },
  chips: { flexDirection: 'row', gap: spacing['space-2'] },
  chip: {
    minHeight: sizes['control-height-sm'],
    paddingHorizontal: spacing['space-3'],
    borderRadius: radii['radius-pill'],
    justifyContent: 'center',
  },
  results: { borderRadius: radii['radius-lg'], paddingHorizontal: spacing['space-4'] },
  divider: { height: 1 },
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
  add: {
    minHeight: sizes['control-height'],
    marginTop: spacing['space-3'],
    borderRadius: radii['radius-pill'],
    justifyContent: 'center',
    alignItems: 'center',
  },
});
