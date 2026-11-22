export function formatElapsedDuration(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours} h`;
}

export function exerciseLine(names: readonly string[]) {
  const shown = 3;
  if (names.length <= shown) return names.join(' · ');
  return `${names.slice(0, shown).join(' · ')} · +${names.length - shown} more`;
}
