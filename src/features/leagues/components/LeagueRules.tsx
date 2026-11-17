import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { textStyles, usePalette } from '@/theme/tokens';

import { LeagueAction, LeagueCard, leagueStyles } from './LeagueUI';

export function LeagueRules({ timezone }: Readonly<{ timezone: string | null }>) {
  const p = usePalette();
  const [expanded, setExpanded] = useState(false);
  return (
    <LeagueCard>
      <Text accessibilityRole="header" style={[textStyles['title-md'], { color: p.ink }]}>
        League rules
      </Text>
      <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
        Fixed rules · the same scoring for every member
      </Text>
      {[
        ['Score', 'Gym volume × elapsed hours ÷ body weight (kg). Whole points; halves round up.'],
        [
          'Daily credit',
          'Only your highest scoring gym workout each day counts. No credit before joining.',
        ],
        ['Weekly rounds', `Monday to Monday, 00:00 · ${timezone ?? 'Calendar not configured'}`],
        ['Standings', 'All rounds count toward the general total. Equal totals share a rank.'],
        [
          'Round outcome',
          'With two or more members, everyone tied for the lowest score loses, including zero scores.',
        ],
      ].map(([label, value]) => (
        <View key={label} style={leagueStyles.section}>
          <Text style={[textStyles.label, { color: p.ink }]}>{label}</Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{value}</Text>
        </View>
      ))}
      <LeagueAction
        label={expanded ? 'Hide scoring details' : 'Show scoring details'}
        onPress={() => setExpanded(!expanded)}
      />
      {expanded ? (
        <>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            Score = workout volume × elapsed hours ÷ body weight in kg, rounded to the nearest whole
            point (halves round up). Volume is the sum of confirmed repetitions × weight in kg.
            Elapsed time includes pauses; body weight is taken from your profile when you complete
            the workout. Missing or non-positive inputs earn no credit.
          </Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            Only gym workouts count. A workout must start at or after you join and end and be
            submitted while its round is open. Each day only your highest rounded score counts. Ties
            choose the earliest completion, then the lowest workout ID. The same workout can count
            in more than one league.
          </Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            The workout start determines its day in this league’s timezone:{' '}
            {timezone ?? 'not set for this older league'}. A round runs from Monday 00:00 inclusive
            to the next Monday 00:00 exclusive, including daylight-saving changes.
          </Text>
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            General standings sum all rounds, including the current round. Equal totals share a
            rank. When a round has at least two members, everyone tied for the lowest total loses,
            including members with zero points. Unseen results are shown oldest first and
            acknowledged after display.
          </Text>
        </>
      ) : null}
    </LeagueCard>
  );
}
