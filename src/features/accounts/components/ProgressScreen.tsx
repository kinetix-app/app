import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileBack } from './ProfileBack';
import { ScreenHeader } from '@/components/ScreenHeader';
import { textStyles, usePalette } from '@/theme/tokens';
import { displayWeight } from '../profileForm';
import type { Account } from '../schemas';
import { ProfileGroup } from './ProfileRows';
import { setupStyles as s } from './SetupUI';

export function ProgressScreen({
  account,
  onClose,
}: Readonly<{ account: Account; onClose: () => void }>) {
  const p = usePalette();
  const system = account.profile.measurement_system ?? 'metric';
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[s.screen, { backgroundColor: p['surface-100'] }]}
    >
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader title="Progress" leading={<ProfileBack onPress={onClose} />} />
        <ProfileGroup title="Weight">
          <View style={s.card}>
            <Text style={[textStyles['title-md'], { color: p.ink }]}>
              {account.profile.weight_kg
                ? `${displayWeight(account.profile.weight_kg, system)} ${system === 'imperial' ? 'lb' : 'kg'}`
                : 'No saved weight'}
            </Text>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              Current profile value · Weight history is not available yet.
            </Text>
          </View>
        </ProfileGroup>
        <ProfileGroup title="Measurements">
          <View style={s.card}>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              Measurement recording is not available yet.
            </Text>
          </View>
        </ProfileGroup>
        <ProfileGroup title="Strength">
          <View style={s.card}>
            <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
              Strength trends are not available yet.
            </Text>
          </View>
        </ProfileGroup>
      </ScrollView>
    </SafeAreaView>
  );
}
