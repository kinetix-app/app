import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { selectCopy, useLanguage } from '@/i18n/Language';
import { CalendarGrid, calendarDate, calendarLabel, shiftCalendarMonth } from './CalendarGrid';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

const monthFormat = (language: 'en' | 'es') =>
  new Intl.DateTimeFormat(selectCopy(language === 'es', 'es-ES', 'en-US'), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
const shortMonth = (language: 'en' | 'es') =>
  new Intl.DateTimeFormat(selectCopy(language === 'es', 'es-ES', 'en-US'), {
    month: 'short',
    timeZone: 'UTC',
  });

export function DatePickerField({
  label,
  value,
  optional,
  disabled,
  invalid,
  onOpen,
  onClear,
}: Readonly<{
  label: string;
  value: string;
  optional?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  onOpen: () => void;
  onClear: () => void;
}>) {
  const p = usePalette();
  const language = useLanguage();
  const currentLabel = value
    ? calendarLabel(value, language)
    : selectCopy(language === 'es', 'Elige una fecha', 'Choose a date');

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[textStyles.label, { color: p.ink }]}>{label}</Text>
        {optional && !value ? (
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            {selectCopy(language === 'es', 'Opcional', 'Optional')}
          </Text>
        ) : null}
      </View>
      <View style={styles.labelRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={currentLabel}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onOpen}
          style={({ pressed }) => [
            styles.trigger,
            {
              backgroundColor: p['surface-300'],
              borderColor: invalid ? p.danger : p['line-strong'],
              opacity: disabled || pressed ? 0.65 : 1,
            },
          ]}
        >
          <Feather name="calendar" color={p['ink-muted']} size={18} />
          <Text style={[textStyles.body, styles.date, { color: value ? p.ink : p['ink-muted'] }]}>
            {currentLabel}
          </Text>
        </Pressable>
        {optional && value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${selectCopy(language === 'es', 'Borrar', 'Clear')} ${label.toLowerCase()}`}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onClear}
            style={styles.arrow}
          >
            <Feather name="x" color={p['ink-muted']} size={19} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function DatePickerCalendar({
  value,
  today,
  maxDate,
  onSelect,
}: Readonly<{
  value: string;
  today: string;
  maxDate?: string;
  onSelect: (date: string) => void;
}>) {
  const p = usePalette();
  const language = useLanguage();
  const [month, setMonth] = useState(() => shiftCalendarMonth(value || today, 0));
  const [isChoosingMonth, setIsChoosingMonth] = useState(false);
  const year = month.slice(0, 4);
  const next = shiftCalendarMonth(
    isChoosingMonth ? `${year}-01-01` : month,
    isChoosingMonth ? 12 : 1,
  );
  const nextDisabled = Boolean(maxDate && next > maxDate);

  return (
    <View style={styles.picker}>
      <View style={styles.navigation}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isChoosingMonth
              ? selectCopy(language === 'es', 'Año anterior', 'Previous year')
              : selectCopy(language === 'es', 'Mes anterior', 'Previous month')
          }
          onPress={() => setMonth(shiftCalendarMonth(month, isChoosingMonth ? -12 : -1))}
          style={styles.arrow}
        >
          <Feather name="chevron-left" size={21} color={p.ink} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isChoosingMonth
              ? selectCopy(language === 'es', 'Mostrar días', 'Show days')
              : selectCopy(language === 'es', 'Elegir mes y año', 'Choose month and year')
          }
          onPress={() => setIsChoosingMonth(!isChoosingMonth)}
          style={styles.period}
        >
          <Text style={[textStyles.label, { color: p.ink }]}>
            {isChoosingMonth ? year : monthFormat(language).format(calendarDate(month))}
          </Text>
          <Feather
            name={isChoosingMonth ? 'chevron-up' : 'chevron-down'}
            size={15}
            color={p['ink-muted']}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isChoosingMonth
              ? selectCopy(language === 'es', 'Año siguiente', 'Next year')
              : selectCopy(language === 'es', 'Mes siguiente', 'Next month')
          }
          accessibilityState={{ disabled: nextDisabled }}
          disabled={nextDisabled}
          onPress={() => setMonth(next)}
          style={styles.arrow}
        >
          <Feather name="chevron-right" size={21} color={nextDisabled ? p.line : p.ink} />
        </Pressable>
      </View>
      {isChoosingMonth ? (
        <View style={styles.months}>
          {Array.from({ length: 12 }, (_, index) => {
            const id = `${year}-${String(index + 1).padStart(2, '0')}-01`;
            const disabledMonth = Boolean(maxDate && id > maxDate);
            const selected = id === month;
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={monthFormat(language).format(calendarDate(id))}
                accessibilityState={{ disabled: disabledMonth, selected }}
                disabled={disabledMonth}
                onPress={() => {
                  setMonth(id);
                  setIsChoosingMonth(false);
                }}
                style={[styles.month, selected && { backgroundColor: p['brand-soft'] }]}
              >
                <Text
                  style={[
                    textStyles.label,
                    {
                      color: selected ? p['brand-ink'] : p.ink,
                      opacity: disabledMonth ? 0.45 : 1,
                    },
                  ]}
                >
                  {shortMonth(language).format(calendarDate(id))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <CalendarGrid
          month={month}
          today={today}
          selected={value}
          maxDate={maxDate}
          onSelect={onSelect}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing['space-1'] },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-2'] },
  trigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-2'],
    minHeight: sizes['control-height'],
    paddingHorizontal: spacing['space-3'],
    borderRadius: radii['radius-md'],
    borderWidth: 1,
  },
  date: { flex: 1 },
  picker: { gap: spacing['space-1'] },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: {
    width: sizes['tap-min'],
    height: sizes['tap-min'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  period: {
    minHeight: sizes['tap-min'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-1'],
  },
  months: { flexDirection: 'row', flexWrap: 'wrap' },
  month: {
    width: '25%',
    height: sizes['tap-min'],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii['radius-sm'],
  },
});
