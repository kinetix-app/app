import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, shadows, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { LeagueCard, LeagueIconButton, leagueStyles } from './LeagueUI';

const rules = [
  {
    title: 'Score',
    icon: 'calculator-outline',
    summary: 'Gym volume × elapsed hours ÷ body weight (kg)',
    detail:
      'Volume is the sum of confirmed repetitions × weight in kg. Elapsed time includes pauses. Your profile weight is recorded at completion. Whole points are rounded half up. Missing or non-positive inputs earn no credit.',
  },
  {
    title: 'Daily credit',
    icon: 'flash-outline',
    summary: 'Your best gym workout each day',
    detail:
      'Only your highest rounded score each day counts. Start at or after joining and finish and submit before the round closes. For ties, the earliest completion wins, then the lowest workout ID. A workout can count in multiple leagues.',
  },
  {
    title: 'Weekly rounds',
    icon: 'calendar-outline',
    summary: 'Monday at midnight to the following Monday',
    detail:
      'The workout start determines its league-local day. Each round starts Monday 00:00 inclusive and ends the next Monday 00:00 exclusive, including daylight-saving changes.',
  },
  {
    title: 'Standings',
    icon: 'podium-outline',
    summary: 'All rounds count toward the overall total',
    detail: 'General standings include the current and all past rounds. Equal totals share a rank.',
  },
  {
    title: 'Round outcome',
    icon: 'flag-outline',
    summary: 'Lowest scores share the losing position',
    detail:
      'With at least two members, everyone tied for the lowest round total loses, including zero scores. Unseen results appear oldest first and are acknowledged after display.',
  },
] as const;

export function LeagueRules({ timezone }: Readonly<{ timezone: string | null }>) {
  const p = usePalette();
  const [tip, setTip] = useState<(typeof rules)[number] | null>(null);
  const dismiss = () => setTip(null);
  useEffect(() => {
    if (!tip) return;
    const timer = setTimeout(() => setTip(null), 12000);
    return () => clearTimeout(timer);
  }, [tip]);

  return (
    <LeagueCard>
      <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
        League rules
      </Text>
      <View>
        {rules.map((rule, index) => (
          <Pressable
            key={rule.title}
            accessibilityRole="button"
            accessibilityLabel={`About ${rule.title.toLowerCase()}`}
            accessibilityHint={rule.summary}
            onPress={() => setTip(rule)}
            style={({ pressed }) => [
              leagueStyles.row,
              {
                borderTopWidth: index === 0 ? 0 : 1,
                borderColor: p.line,
                minHeight: sizes['tap-min'],
                paddingVertical: spacing['space-2'],
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name={rule.icon} size={20} color={p['brand-ink']} />
            <View style={{ flex: 1, minWidth: 0, gap: spacing['space-1'] }}>
              <Text style={[textStyles.label, { color: p.ink }]}>{rule.title}</Text>
              <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{rule.summary}</Text>
            </View>
            <Ionicons name="information-circle-outline" size={20} color={p['ink-muted']} />
          </Pressable>
        ))}
      </View>
      {tip ? (
        <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
          <SafeAreaView
            style={{ flex: 1, justifyContent: 'flex-end', padding: spacing['space-4'] }}
          >
            <Pressable
              accessible={false}
              importantForAccessibility="no"
              tabIndex={-1}
              onPress={dismiss}
              style={{ position: 'absolute', inset: 0 }}
            />
            <View
              accessibilityViewIsModal
              style={{
                alignSelf: 'center',
                width: '100%',
                maxWidth: 560,
                maxHeight: '65%',
                backgroundColor: p['surface-300'],
                borderRadius: radii['radius-lg'],
                borderColor: p['line-strong'],
                borderWidth: 1,
                boxShadow: shadows()['shadow-pop'],
              }}
            >
              <ScrollView contentContainerStyle={{ padding: spacing['space-4'] }}>
                <View style={leagueStyles.row}>
                  <Ionicons name="information-circle-outline" size={24} color={p.info} />
                  <Text style={[textStyles['title-md'], { flex: 1, color: p.ink }]}>
                    {tip.title}
                  </Text>
                  <LeagueIconButton label="Dismiss rule tip" icon="close" onPress={dismiss} />
                </View>
                <Text
                  accessibilityLiveRegion="polite"
                  role="status"
                  style={[textStyles.body, { color: p.ink }]}
                >
                  {tip.detail}
                  {tip.title === 'Weekly rounds' && timezone
                    ? ` League timezone: ${timezone}.`
                    : ''}
                </Text>
              </ScrollView>
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}
    </LeagueCard>
  );
}
