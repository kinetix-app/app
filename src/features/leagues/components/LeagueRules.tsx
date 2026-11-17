import React from 'react';
import { Text, View } from 'react-native';
import { spacing, textStyles, usePalette } from '@/theme/tokens';

export function LeagueRules({ timezone }: Readonly<{ timezone: string | null }>) {
  const p = usePalette();
  return (
    <View style={{ gap: spacing['space-2'] }}>
      <Text accessibilityRole="header" style={[textStyles.heading, { color: p.ink }]}>
        League rules
      </Text>
      <Text style={{ color: p.ink }}>
        Score = workout volume × elapsed hours ÷ body weight in kg, rounded to the nearest whole
        point (halves round up). Volume is the sum of confirmed repetitions × weight in kg. Elapsed
        time includes pauses; body weight is taken from your profile when you complete the workout.
        Missing or non-positive inputs earn no credit.
      </Text>
      <Text style={{ color: p.ink }}>
        Only gym workouts count. A workout must start at or after you join and end and be submitted
        while its round is open. Each day only your highest rounded score counts. Ties choose the
        earliest completion, then the lowest workout ID. The same workout can count in more than one
        league.
      </Text>
      <Text style={{ color: p.ink }}>
        The workout start determines its day in this league’s timezone:{' '}
        {timezone ?? 'not set for this older league'}. A round runs from Monday 00:00 inclusive to
        the next Monday 00:00 exclusive, including daylight-saving changes.
      </Text>
      <Text style={{ color: p.ink }}>
        General standings sum all rounds, including the current round. Equal totals share a rank.
        When a round has at least two members, everyone tied for the lowest total loses, including
        members with zero points. Unseen results are shown oldest first and acknowledged after
        display.
      </Text>
    </View>
  );
}
