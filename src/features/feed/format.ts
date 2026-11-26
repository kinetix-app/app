/** Display helpers for feed posts; totals themselves come from the backend. */

export { personName as authorName } from '@/components/InitialAvatar';

export function relativeTime(iso: string, now: number = Date.now(), language: 'en' | 'es' = 'en') {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return language === 'es' ? 'Ahora mismo' : 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return language === 'es' ? `Hace ${minutes} min` : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return language === 'es' ? `Hace ${hours} h` : `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return language === 'es' ? `Hace ${days} d` : `${days} d ago`;
  return new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}

export function countLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export { blobToDataUri } from '@/services/blob';
