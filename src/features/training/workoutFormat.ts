export function formatElapsedDuration(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours} h`;
}

/** Volume stays in explicitly labelled kilograms, without float rounding of the decimal text. */
export function formatWorkoutVolume(kilograms?: string) {
  return kilograms === undefined ? '—' : `${formatWorkoutDecimal(kilograms, true)} kg`;
}

function groupThousands(digits: string) {
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3)
    groups.unshift(digits.slice(Math.max(0, end - 3), end));
  return groups.join(',');
}

function trimTrailingZeros(digits: string) {
  let end = digits.length;
  while (end > 0 && digits[end - 1] === '0') end -= 1;
  return digits.slice(0, end);
}

function withFraction(whole: string, fraction: string) {
  return fraction ? `${whole}.${fraction}` : whole;
}

/** Trims trailing zeros from backend decimal text without converting it to a float. */
export function formatWorkoutDecimal(text: string, grouped = false) {
  const [whole, fraction = ''] = text.split('.');
  return withFraction(grouped ? groupThousands(whole) : whole, trimTrailingZeros(fraction));
}
