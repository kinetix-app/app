export type CardioValues = {
  distance?: string;
  hours?: string;
  minutes?: string;
  seconds?: string;
};

export function cardioInput(value: CardioValues) {
  const { distance = '', hours = '', minutes = '', seconds = '' } = value;
  if (!/^\d+(\.\d{1,2})?$/.test(distance) || Number(distance) > 999999.99) return null;
  if (![hours, minutes, seconds].every((item) => /^\d+$/.test(item))) return null;
  const duration = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  if (Number(minutes) > 59 || Number(seconds) > 59 || duration > 2147483647) return null;
  return { duration_seconds: duration, distance_km: distance };
}

export function cardioValues(duration: number | null, distance: string | null): CardioValues {
  return {
    distance: distance ?? '',
    hours: duration === null ? '' : String(Math.floor(duration / 3600)),
    minutes: duration === null ? '' : String(Math.floor((duration % 3600) / 60)),
    seconds: duration === null ? '' : String(duration % 60),
  };
}

/** Compact clock for set fields and exercise-card summaries. */
export function formatCardioTime(hours: string, minutes: string, seconds: string) {
  const parts = Number(hours) > 0 ? [hours, minutes, seconds] : [minutes, seconds];
  return parts.map((part) => (part || '0').padStart(2, '0')).join(':');
}
