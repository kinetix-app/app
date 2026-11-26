import { useLanguage } from '@/i18n/Language';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextField } from '@/components/TextField';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { leaguesApi } from '../api';
import { LeagueAction, LeagueDropdownTrigger, LeagueIconButton, leagueStyles } from './LeagueUI';

export function LeagueTimezonePicker({
  value,
  onChange,
  disabled,
}: Readonly<{
  value: string;
  onChange: (timezone: string) => void;
  disabled: boolean;
}>) {
  const language = useLanguage();
  const t = (en: string, es: string) => (language === 'es' ? es : en);
  const p = usePalette();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const zones = useQuery({
    queryKey: ['league-timezones'],
    queryFn: ({ signal }) => leaguesApi.timezones(signal),
    enabled: open,
    staleTime: Infinity,
  });
  const normalized = search.trim().toLowerCase().replaceAll(' ', '_');
  const filtered = zones.data?.filter((zone) => zone.toLowerCase().includes(normalized)) ?? [];
  function close() {
    setOpen(false);
    setSearch('');
  }
  function renderTimezones() {
    if (zones.isPending)
      return (
        <ActivityIndicator
          accessibilityLabel={t('Loading timezones', 'Cargando zonas horarias')}
          color={p.brand}
        />
      );
    if (zones.isError)
      return (
        <LeagueAction
          label={t('Retry timezones', 'Reintentar zonas horarias')}
          onPress={() => {
            void zones.refetch();
          }}
        />
      );
    return (
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={filtered}
        keyExtractor={(zone) => zone}
        ListEmptyComponent={
          <Text style={[textStyles.body, { color: p['ink-muted'] }]}>
            {t('No matching timezones.', 'No hay zonas horarias coincidentes.')}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item}
            accessibilityState={{ selected: value === item }}
            aria-selected={value === item}
            onPress={() => {
              onChange(item);
              close();
            }}
            style={[
              leagueStyles.row,
              { minHeight: sizes['tap-min'], paddingHorizontal: spacing['space-2'] },
            ]}
          >
            <Text style={[textStyles.body, { color: p.ink, flex: 1 }]}>{item}</Text>
            {value === item ? <Ionicons name="checkmark" size={20} color={p.brand} /> : null}
          </Pressable>
        )}
      />
    );
  }

  return (
    <View style={{ gap: spacing['space-2'] }}>
      <Text style={[textStyles.label, { color: p.ink }]}>{t('Timezone', 'Zona horaria')}</Text>
      <LeagueDropdownTrigger
        label={`${t('Timezone', 'Zona horaria')}: ${value}`}
        value={value}
        expanded={open}
        disabled={disabled}
        onPress={() => setOpen(true)}
      />
      {open ? (
        <Modal transparent visible animationType="fade" onRequestClose={close}>
          <SafeAreaView
            style={{
              flex: 1,
              justifyContent: 'center',
              padding: spacing['space-4'],
              backgroundColor: p.scrim,
            }}
          >
            <View
              accessibilityViewIsModal
              style={{
                width: '100%',
                maxWidth: 440,
                alignSelf: 'center',
                height: Math.min(height * 0.75, 560),
                padding: spacing['space-4'],
                gap: spacing['space-3'],
                borderRadius: radii['radius-xl'],
                backgroundColor: p['surface-200'],
              }}
            >
              <View style={[leagueStyles.row, { justifyContent: 'space-between' }]}>
                <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
                  {t('Choose timezone', 'Elegir zona horaria')}
                </Text>
                <LeagueIconButton
                  label={t('Close timezone selector', 'Cerrar selector de zona horaria')}
                  icon="close"
                  onPress={close}
                />
              </View>
              <TextField
                accessibilityLabel={t('Search timezones', 'Buscar zonas horarias')}
                placeholder={t('Search city or region', 'Buscar ciudad o región')}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
              />
              {renderTimezones()}
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}
    </View>
  );
}
