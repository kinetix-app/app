import { z } from 'zod/v4';
import { objectiveSchema } from './schemas';

const kg = { unit: 'kg', min: 0, max: 1000, places: 6 };
const cm = { unit: 'cm', min: 0, max: 999.99, places: 2 };

export const measurementDefinitions = {
  weight_kg: { label: 'Weight', ...kg },
  height_cm: { label: 'Height', ...cm, max: 300 },
  body_fat_percentage: { label: 'Body fat', unit: '%', min: 0, max: 100, places: 2 },
  muscle_mass_kg: { label: 'Muscle mass', ...kg },
  waist_cm: { label: 'Waist', ...cm },
  chest_cm: { label: 'Chest', ...cm },
  arm_cm: { label: 'Arm', ...cm },
  thigh_cm: { label: 'Thigh', ...cm },
} as const;

export type MeasurementMetric = keyof typeof measurementDefinitions;
export const measurementMetrics = Object.keys(measurementDefinitions) as MeasurementMetric[];
export const dateOnlySchema = z.iso.date();

function decimal(metric: MeasurementMetric) {
  const { min, max, places } = measurementDefinitions[metric];
  return z
    .string()
    .regex(new RegExp(String.raw`^\d+(?:\.\d{1,${places}})?$`))
    .refine((value) => {
      const number = Number(value);
      return number <= max && (metric === 'body_fat_percentage' ? number >= min : number > min);
    });
}

const measurementFields = {
  weight_kg: decimal('weight_kg').nullable(),
  height_cm: decimal('height_cm').nullable(),
  body_fat_percentage: decimal('body_fat_percentage').nullable(),
  muscle_mass_kg: decimal('muscle_mass_kg').nullable(),
  waist_cm: decimal('waist_cm').nullable(),
  chest_cm: decimal('chest_cm').nullable(),
  arm_cm: decimal('arm_cm').nullable(),
  thigh_cm: decimal('thigh_cm').nullable(),
};

const storedDecimal = z
  .string()
  .regex(/^-?\d+(?:\.\d+)?$/)
  .refine((value) => Number.isFinite(Number(value)))
  .nullable();

const measurementSchema = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  date: dateOnlySchema,
  weight_kg: storedDecimal,
  height_cm: storedDecimal,
  body_fat_percentage: storedDecimal,
  muscle_mass_kg: storedDecimal,
  waist_cm: storedDecimal,
  chest_cm: storedDecimal,
  arm_cm: storedDecimal,
  thigh_cm: storedDecimal,
});

export const bodyMeasurementsSchema = z.object({ items: z.array(measurementSchema) });
export const createMeasurementSchema = z
  .object(measurementFields)
  .partial()
  .extend({ request_id: z.uuid(), date: dateOnlySchema })
  .strict()
  .refine((item) => measurementMetrics.some((metric) => item[metric] != null));
export const physicalTargetValueSchema = z.object({
  weight_kg: decimal('weight_kg'),
  target_date: dateOnlySchema.nullable(),
});
export const physicalTargetSchema = z.object({
  objective: objectiveSchema.nullable(),
  target: physicalTargetValueSchema.nullable(),
});
export const savePhysicalTargetSchema = physicalTargetValueSchema
  .extend({ objective: objectiveSchema })
  .strict();
export { measurementSchema };
export type BodyMeasurement = z.infer<typeof measurementSchema>;
export type BodyMeasurements = z.infer<typeof bodyMeasurementsSchema>;
export type CreateMeasurement = z.infer<typeof createMeasurementSchema>;
export type PhysicalTarget = z.infer<typeof physicalTargetSchema>;
export type SavePhysicalTarget = z.infer<typeof savePhysicalTargetSchema>;
