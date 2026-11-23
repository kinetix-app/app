import { apiClient } from '@/services/apiClient';
import {
  bodyMeasurementsSchema,
  createMeasurementSchema,
  measurementSchema,
  physicalTargetSchema,
  savePhysicalTargetSchema,
  type CreateMeasurement,
  type SavePhysicalTarget,
} from './progressSchemas';

const measurementPath = '/api/v1/me/body-measurements';
const targetPath = '/api/v1/me/physical-target';

export const measurementKey = (accountId: number) =>
  ['accounts', accountId, 'body-measurements'] as const;
export const targetKey = (accountId: number) => ['accounts', accountId, 'physical-target'] as const;

export const progressApi = {
  measurements: (signal?: AbortSignal) =>
    apiClient.get(measurementPath, { schema: bodyMeasurementsSchema, signal }),
  record: (input: CreateMeasurement) =>
    apiClient.post(measurementPath, createMeasurementSchema.parse(input), {
      schema: measurementSchema,
    }),
  target: (signal?: AbortSignal) =>
    apiClient.get(targetPath, { schema: physicalTargetSchema, signal }),
  saveTarget: (input: SavePhysicalTarget) =>
    apiClient.put(targetPath, savePhysicalTargetSchema.parse(input), {
      schema: physicalTargetSchema,
    }),
};
