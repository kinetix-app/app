import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AnimatedTextSelector } from '@/components/AnimatedTextSelector';
import { spacing } from '@/theme/tokens';

export function ChartMetricSelector<Metric extends string>({
  metrics,
  value,
  label,
  labelFor,
  onChange,
  reduceMotion = true,
}: Readonly<{
  metrics: readonly Metric[];
  value: Metric;
  label: string;
  labelFor: (metric: Metric) => string;
  onChange: (metric: Metric) => void;
  reduceMotion?: boolean;
}>) {
  return (
    <ScrollView
      horizontal
      accessibilityRole="tablist"
      accessibilityLabel={label}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.options}
    >
      {metrics.map((metric) => (
        <AnimatedTextSelector
          key={metric}
          label={labelFor(metric)}
          selected={value === metric}
          role="tab"
          reduceMotion={reduceMotion}
          onPress={() => onChange(metric)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  options: { gap: spacing['space-4'] },
});
