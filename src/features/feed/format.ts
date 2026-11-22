/** Display helpers for feed posts; totals themselves come from the backend. */

import { formatWorkoutDecimal } from '@/features/training/workoutFormat';

export { personName as authorName } from '@/components/InitialAvatar';

export function relativeTime(iso: string, now: number = Date.now()) {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

export function duration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${minutes / 60} h`;
}

/** One recorded set, e.g. "8 reps × 100 kg", "30 s" or "2.5 km in 12 min". */
export function setLine(set: {
  reps: number | null;
  weight_kg: string | null;
  duration_seconds: number | null;
  distance_km: string | null;
}) {
  const parts: string[] = [];
  if (set.reps !== null) parts.push(`${set.reps} ${set.reps === 1 ? 'rep' : 'reps'}`);
  if (set.weight_kg !== null && Number(set.weight_kg) > 0)
    parts.push(`${formatWorkoutDecimal(set.weight_kg)} kg`);
  const work = parts.join(' × ');
  const extra: string[] = [];
  if (set.distance_km !== null) extra.push(`${formatWorkoutDecimal(set.distance_km)} km`);
  if (set.duration_seconds !== null)
    extra.push(
      set.duration_seconds < 60 ? `${set.duration_seconds} s` : duration(set.duration_seconds),
    );
  return [work, extra.join(' in ')].filter(Boolean).join(' · ') || 'Done';
}

export function countLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export { blobToDataUri } from '@/services/blob';
