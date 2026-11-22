import { z } from 'zod/v4';

import {
  canonicalHeight,
  canonicalLength,
  canonicalWeight,
  displayHeight,
  displayLength,
  displayWeight,
  savedWeight,
  type MeasurementSystem,
} from './profileForm';
import {
  dateOnlySchema,
  measurementDefinitions,
  measurementMetrics,
  type BodyMeasurement,
  type CreateMeasurement,
  type MeasurementMetric,
} from './progressSchemas';

const decimalInput = /^\d{1,5}(?:\.\d{1,2})?$/;
const measurementFormShape = z.object({
  date: z.string().trim(),
  weight_kg: z.string().trim(),
  height_cm: z.string().trim(),
  height_ft: z.string().trim(),
  height_in: z.string().trim(),
  body_fat_percentage: z.string().trim(),
  muscle_mass_kg: z.string().trim(),
  waist_cm: z.string().trim(),
  chest_cm: z.string().trim(),
  arm_cm: z.string().trim(),
  thigh_cm: z.string().trim(),
});

export type MeasurementFormValues = z.input<typeof measurementFormShape>;
export const measurementDefaults = (date: string): MeasurementFormValues => ({
  date,
  weight_kg: '',
  height_cm: '',
  height_ft: '',
  height_in: '',
  body_fat_percentage: '',
  muscle_mass_kg: '',
  waist_cm: '',
  chest_cm: '',
  arm_cm: '',
  thigh_cm: '',
});

type MeasurementDraft = {
  values: MeasurementFormValues;
  previous: Partial<Record<MeasurementMetric, string>>;
};

export function latestMeasurementDraft(
  date: string,
  system: MeasurementSystem,
  items: readonly BodyMeasurement[],
): MeasurementDraft {
  const values = measurementDefaults(date);
  const previous: MeasurementDraft['previous'] = {};
  for (const metric of measurementMetrics) {
    const raw = items.findLast((item) => item[metric] !== null)?.[metric];
    if (raw == null || !validCanonical(raw, metric)) continue;
    previous[metric] = raw;
    if (metric === 'height_cm' && system === 'imperial') {
      const height = displayHeight(raw);
      values.height_ft = height.height_ft;
      values.height_in = height.height_in;
    } else if (measurementDefinitions[metric].unit === 'kg') {
      values[metric] = displayWeight(raw, system);
    } else if (measurementDefinitions[metric].unit === 'cm') {
      values[metric] = displayLength(raw, system);
    } else {
      values[metric] = Number(raw).toFixed(2);
    }
  }
  return { values, previous };
}

export function todayForProfile(timeZone: string | null, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timeZone ?? 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (key: string) => parts.find(({ type }) => type === key)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
export function displayProgressDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

export function measurementUnit(metric: MeasurementMetric, system: MeasurementSystem) {
  const { unit } = measurementDefinitions[metric];
  if (system === 'metric' || unit === '%') return unit;
  if (unit === 'kg') return 'lb';
  return metric === 'height_cm' ? 'ft and in' : 'in';
}

export function shownMeasurement(
  metric: MeasurementMetric,
  raw: string,
  system: MeasurementSystem,
) {
  const sign = raw.startsWith('-') ? '-' : '';
  const absolute = sign ? raw.slice(1) : raw;
  if (metric === 'height_cm' && system === 'imperial') {
    const { height_ft, height_in } = displayHeight(absolute);
    return `${sign}${height_ft} ft ${height_in} in`;
  }
  const { unit } = measurementDefinitions[metric];
  let shown = Number(absolute).toFixed(2);
  if (unit === 'kg') shown = displayWeight(absolute, system);
  else if (unit === 'cm') shown = displayLength(absolute, system);
  return unit === '%' ? `${sign}${shown}%` : `${sign}${shown} ${measurementUnit(metric, system)}`;
}

export function measurementSeries(
  items: readonly BodyMeasurement[],
  metric: MeasurementMetric,
  system: MeasurementSystem,
) {
  const byDate = new Map<string, string>();
  for (const item of items) {
    const raw = item[metric];
    if (raw !== null) byDate.set(item.date, raw);
  }
  return Array.from(byDate, ([date, raw]) => {
    const { unit } = measurementDefinitions[metric];
    const amount = Number(raw);
    const conversion = unit === 'kg' ? 0.45359237 : 2.54;
    const value = system === 'metric' || unit === '%' ? amount : amount / conversion;
    return { date, value, label: shownMeasurement(metric, raw, system) };
  });
}

export function measurementAxis(
  value: number,
  metric: MeasurementMetric,
  system: MeasurementSystem,
  showUnit: boolean,
) {
  if (metric === 'height_cm' && system === 'imperial') {
    const sign = value < 0 ? '-' : '';
    const totalTenths = Math.round(Math.abs(value) * 10);
    const feet = Math.floor(totalTenths / 120);
    return `${sign}${feet}′ ${((totalTenths % 120) / 10).toFixed(1)}″`;
  }
  const unit = showUnit ? measurementUnit(metric, system) : '';
  if (unit === '%') return `${value.toFixed(1)}%`;
  const suffix = unit ? ' ' + unit : '';
  return `${value.toFixed(1)}${suffix}`;
}

function validCanonical(value: string, metric: MeasurementMetric) {
  const { min, max } = measurementDefinitions[metric];
  const number = Number(value);
  return number <= max && (metric === 'body_fat_percentage' ? number >= min : number > min);
}

function metricError(metric: MeasurementMetric, system: MeasurementSystem) {
  const { label, max } = measurementDefinitions[metric];
  const minimum = metric === 'body_fat_percentage' ? '0 to' : 'greater than 0 and at most';
  const limit = shownMeasurement(metric, String(max), system);
  return `${label} must be ${minimum} ${limit}.`;
}

type AddIssue = (field: keyof MeasurementFormValues, message: string) => void;

function imperialHeight(values: MeasurementFormValues, issue: AddIssue) {
  const feet = values.height_ft || '0';
  const inches = values.height_in || '0';
  const validFeet = /^\d$/.test(feet);
  const validInches = decimalInput.test(inches) && Number(inches) < 12;
  if (!validFeet) issue('height_ft', 'Enter whole feet from 0 to 9.');
  if (!validInches) issue('height_in', 'Enter inches from 0 to less than 12.');
  if (!validFeet || !validInches) return undefined;
  const cm = canonicalHeight({ ...values, height_ft: feet, height_in: inches }, 'imperial');
  if (validCanonical(cm, 'height_cm')) return cm;
  issue('height_in', metricError('height_cm', 'imperial'));
}

function canonicalMeasurement(raw: string, metric: MeasurementMetric, system: MeasurementSystem) {
  const { unit } = measurementDefinitions[metric];
  if (unit === 'kg') return canonicalWeight(raw, system);
  if (unit === 'cm') return canonicalLength(raw, system);
  return Number(raw).toFixed(2);
}

function readMeasurements(
  values: MeasurementFormValues,
  system: MeasurementSystem,
  measurement: Omit<CreateMeasurement, 'request_id'>,
  issue: AddIssue,
  initial?: MeasurementDraft,
) {
  for (const metric of measurementMetrics) {
    if (metric === 'height_cm' && system === 'imperial') continue;
    const raw = values[metric];
    if (!raw) continue;
    if (!decimalInput.test(raw)) {
      issue(metric, 'Enter a number with up to two decimal places.');
      continue;
    }
    const canonical =
      raw === initial?.values[metric] && initial.previous[metric] !== undefined
        ? initial.previous[metric]
        : canonicalMeasurement(raw, metric, system);
    if (validCanonical(canonical, metric)) measurement[metric] = canonical;
    else issue(metric, metricError(metric, system));
  }
}

export function measurementFormSchema(
  system: MeasurementSystem,
  today: string,
  initial?: MeasurementDraft,
) {
  return measurementFormShape.transform((values, context) => {
    const issue: AddIssue = (field, message) =>
      context.addIssue({ code: 'custom', path: [field], message });
    if (!dateOnlySchema.safeParse(values.date).success)
      issue('date', 'Enter a valid date in YYYY-MM-DD format.');
    else if (values.date > today) issue('date', 'Choose today or an earlier date.');

    const measurement: Omit<CreateMeasurement, 'request_id'> = { date: values.date };
    const hasImperialHeight = system === 'imperial' && (values.height_ft || values.height_in);
    if (hasImperialHeight) {
      const previousHeight = initial?.previous.height_cm;
      measurement.height_cm =
        previousHeight !== undefined &&
        values.height_ft === initial?.values.height_ft &&
        values.height_in === initial?.values.height_in
          ? previousHeight
          : imperialHeight(values, issue);
    }
    readMeasurements(values, system, measurement, issue, initial);
    const hasValue =
      hasImperialHeight ||
      measurementMetrics.some(
        (metric) => (metric !== 'height_cm' || system === 'metric') && values[metric],
      );
    if (!hasValue) context.addIssue({ code: 'custom', message: 'Enter at least one measurement.' });
    return measurement;
  });
}

export const targetFormShape = z.object({
  weight_kg: z.string().trim(),
  target_date: z.string().trim(),
});
export type TargetFormValues = z.input<typeof targetFormShape>;

export function targetFormSchema(system: MeasurementSystem, original: string | null) {
  return targetFormShape.transform((values, context) => {
    const canonical = decimalInput.test(values.weight_kg)
      ? savedWeight(values.weight_kg, system, original)
      : null;
    if (canonical === null) {
      context.addIssue({
        code: 'custom',
        path: ['weight_kg'],
        message: 'Enter a target weight with up to two decimal places.',
      });
    } else if (!validCanonical(canonical, 'weight_kg')) {
      context.addIssue({
        code: 'custom',
        path: ['weight_kg'],
        message: metricError('weight_kg', system),
      });
    }
    if (values.target_date && !dateOnlySchema.safeParse(values.target_date).success) {
      context.addIssue({
        code: 'custom',
        path: ['target_date'],
        message: 'Enter a valid date in YYYY-MM-DD format.',
      });
    }
    return { weight_kg: canonical ?? '', target_date: values.target_date || null };
  });
}
