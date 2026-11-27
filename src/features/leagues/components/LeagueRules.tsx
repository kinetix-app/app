import { getTranslation } from '@/i18n/catalog';
import { useLanguage } from '@/i18n/Language';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, shadows, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';
import { LeagueCard, LeagueIconButton, leagueStyles } from './LeagueUI';

const rules = [
  {
    id: 'score',
    icon: 'calculator-outline',
    titleKey: 'socialAdditional.ruleScoreTitle',
    summaryKey: 'socialAdditional.ruleScoreSummary',
    detailKey: 'socialAdditional.ruleScoreDetail',
  },
  {
    id: 'dailyCredit',
    icon: 'flash-outline',
    titleKey: 'socialAdditional.ruleDailyCreditTitle',
    summaryKey: 'socialAdditional.ruleDailyCreditSummary',
    detailKey: 'socialAdditional.ruleDailyCreditDetail',
  },
  {
    id: 'weeklyRounds',
    icon: 'calendar-outline',
    titleKey: 'socialAdditional.ruleWeeklyRoundsTitle',
    summaryKey: 'socialAdditional.ruleWeeklyRoundsSummary',
    detailKey: 'socialAdditional.ruleWeeklyRoundsDetail',
  },
  {
    id: 'standings',
    icon: 'podium-outline',
    titleKey: 'socialAdditional.ruleStandingsTitle',
    summaryKey: 'socialAdditional.ruleStandingsSummary',
    detailKey: 'socialAdditional.ruleStandingsDetail',
  },
  {
    id: 'roundOutcome',
    icon: 'flag-outline',
    titleKey: 'socialAdditional.ruleRoundOutcomeTitle',
    summaryKey: 'socialAdditional.ruleRoundOutcomeSummary',
    detailKey: 'socialAdditional.ruleRoundOutcomeDetail',
  },
] as const;

export function LeagueRules({ timezone }: Readonly<{ timezone: string | null }>) {
  const language = useLanguage();
  const p = usePalette();
  const [tip, setTip] = useState<(typeof rules)[number] | null>(null);
  let timezoneSuffix = '';
  if (tip?.id === 'weeklyRounds' && timezone) {
    timezoneSuffix = getTranslation(language)('leagues.leagueTimezone', { timezone });
  }
  const dismiss = () => setTip(null);
  useEffect(() => {
    if (!tip) return;
    const timer = setTimeout(() => setTip(null), 12000);
    return () => clearTimeout(timer);
  }, [tip]);

  return (
    <LeagueCard>
      <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
        {getTranslation(language)('leagues.leagueRules')}
      </Text>
      <View>
        {rules.map((rule, index) => (
          <Pressable
            key={rule.id}
            accessibilityRole="button"
            accessibilityLabel={getTranslation(language)('socialAdditional.aboutRule', {
              title: getTranslation(language)(rule.titleKey).toLowerCase(),
            })}
            accessibilityHint={getTranslation(language)(rule.summaryKey)}
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
              <Text style={[textStyles.label, { color: p.ink }]}>
                {getTranslation(language)(rule.titleKey)}
              </Text>
              <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                {getTranslation(language)(rule.summaryKey)}
              </Text>
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
                    {getTranslation(language)(tip.titleKey)}
                  </Text>
                  <LeagueIconButton
                    label={getTranslation(language)('leagues.dismissRuleTip')}
                    icon="close"
                    onPress={dismiss}
                  />
                </View>
                <Text
                  accessibilityLiveRegion="polite"
                  role="status"
                  style={[textStyles.body, { color: p.ink }]}
                >
                  {getTranslation(language)(tip.detailKey)}
                  {timezoneSuffix}
                </Text>
              </ScrollView>
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}
    </LeagueCard>
  );
}
