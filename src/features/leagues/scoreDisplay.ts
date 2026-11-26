export function roundRange(
  start: string,
  end: string,
  timezone: string,
  language: 'en' | 'es' = 'en',
) {
  const format = new Intl.DateTimeFormat(language === 'es' ? 'es' : undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  });
  // End is exclusive at local midnight. Display the last included calendar day.
  return `${format.format(new Date(start))} – ${format.format(new Date(Date.parse(end) - 1))}`;
}

function formatThousandths(value: bigint) {
  let fraction = String(value % 1000n).padStart(3, '0');
  while (fraction.endsWith('0')) fraction = fraction.slice(0, -1);
  const whole = String(value / 1000n);
  return fraction ? `${whole}.${fraction}` : whole;
}

// Round nonnegative decimal strings half up without converting through a floating-point number.
export function formatScoreMeasurement(value: string) {
  const [whole, fraction = ''] = value.split('.');
  const digits = fraction.padEnd(4, '0');
  const thousandths = BigInt(whole) * 1000n + BigInt(digits.slice(0, 3));
  return formatThousandths(thousandths + (digits[3] >= '5' ? 1n : 0n));
}

export function durationHours(microseconds: string) {
  return formatThousandths((BigInt(microseconds) + 1800000n) / 3600000n);
}
