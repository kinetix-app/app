import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLanguage, type Language } from '@/i18n/Language';
import { radii, sizes, textStyles, usePalette } from '@/theme/tokens';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const longDates = {
  en: new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }),
  es: new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'UTC' }),
};

export function calendarDate(id: string): Date {
  return new Date(`${id}T00:00:00Z`);
}

export function calendarId(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function shiftCalendarMonth(month: string, offset: number): string {
  const date = calendarDate(month);
  date.setUTCMonth(date.getUTCMonth() + offset, 1);
  return calendarId(date);
}

export function calendarLabel(id: string, language: Language = 'en') {
  return longDates[language].format(calendarDate(id));
}

export function CalendarGrid({
  month,
  today,
  selected,
  maxDate,
  onSelect,
}: Readonly<{
  month: string;
  today: string;
  selected: string;
  maxDate?: string;
  onSelect: (date: string) => void;
}>) {
  const p = usePalette();
  const language = useLanguage();
  const days = language === 'es' ? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] : weekdays;
  const start = calendarDate(month);
  const offset = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(1 - offset);
  const dates = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i);
    return date;
  });
  return (
    <>
      <View style={styles.grid}>
        {days.map((day) => (
          <Text key={day} style={[textStyles.caption, styles.weekday, { color: p['ink-muted'] }]}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {dates.map((date) => {
          const id = calendarId(date);
          const isSelected = id === selected;
          const isToday = id === today;
          const inMonth = id.slice(0, 7) === month.slice(0, 7);
          const disabled = Boolean(maxDate && id > maxDate);
          const dayColor = inMonth ? p.ink : p['ink-muted'];
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`${language === 'es' ? 'Seleccionar' : 'Select'} ${calendarLabel(id, language)}${isToday ? (language === 'es' ? ', hoy' : ', today') : ''}`}
              accessibilityState={{ selected: isSelected, disabled }}
              disabled={disabled}
              onPress={() => onSelect(id)}
              style={styles.cell}
            >
              <View
                style={[
                  styles.day,
                  isSelected && { borderWidth: 2, borderColor: p.brand },
                  isToday && !isSelected && { borderWidth: 2, borderColor: `${p.brand}66` },
                ]}
              >
                <Text
                  style={[
                    textStyles.label,
                    {
                      color: isSelected || isToday ? p['brand-ink'] : dayColor,
                      opacity: disabled || (!inMonth && !isSelected) ? 0.45 : 1,
                    },
                  ]}
                >
                  {date.getUTCDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center' },
  cell: {
    width: `${100 / 7}%`,
    height: sizes['tap-min'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: '88%',
    maxWidth: 36,
    height: 36,
    borderRadius: radii['radius-pill'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
