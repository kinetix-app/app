import { getTranslation } from '@/i18n/catalog';
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
          accessibilityLabel={getTranslation(language)('socialAdditional.loadingTimezones_d2c388')}
          color={p.brand}
        />
      );
    if (zones.isError)
      return (
        <LeagueAction
          label={getTranslation(language)('socialAdditional.retryTimezones_9a659d')}
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
            {getTranslation(language)('socialAdditional.noMatchingTimezones_c2d5c2')}
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
      <Text style={[textStyles.label, { color: p.ink }]}>
        {getTranslation(language)('socialAdditional.timezone_61191c')}
      </Text>
      <LeagueDropdownTrigger
        label={`${getTranslation(language)('socialAdditional.timezone_61191c')}: ${value}`}
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
                  {getTranslation(language)('socialAdditional.chooseTimezone_cc3c99')}
                </Text>
                <LeagueIconButton
                  label={getTranslation(language)('socialAdditional.closeTimezoneSelector_3717f5')}
                  icon="close"
                  onPress={close}
                />
              </View>
              <TextField
                accessibilityLabel={getTranslation(language)(
                  'socialAdditional.searchTimezones_a63fa7',
                )}
                placeholder={getTranslation(language)('socialAdditional.searchCityOrRegion_a73bae')}
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
