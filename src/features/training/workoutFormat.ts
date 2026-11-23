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
  if (kilograms === undefined) return '—';
  const [whole, fraction = ''] = kilograms.split('.');
  const digits = groupThousands(whole);
  const decimal = trimTrailingZeros(fraction);
  return decimal ? `${digits}.${decimal} kg` : `${digits} kg`;
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
