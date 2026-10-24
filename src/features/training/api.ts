import { apiClient } from '@/services/apiClient';
import {
  exercisePageSchema,
  exerciseSchema,
  bodyPartsSchema,
  routineInputSchema,
  routinePageSchema,
  routineSchema,
  type RoutineInput,
} from './schemas';

export const trainingApi = {
  routines: (offset: number, signal?: AbortSignal, name = '') =>
    apiClient.get(
      `/api/v1/routines?limit=20&offset=${offset}${name.trim() ? `&name=${encodeURIComponent(name.trim())}` : ''}`,
      {
        schema: routinePageSchema,
        signal,
      },
    ),
  routine: (id: number, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/routines/${id}`, { schema: routineSchema, signal }),
  exercises: (bodyParts: string[], offset: number, signal?: AbortSignal, name = '') =>
    apiClient.get(
      `/api/v1/exercises?limit=20&offset=${offset}${[
        ...new Set(bodyParts.map((part) => part.trim()).filter(Boolean)),
      ]
        .sort()
        .map((part) => `&body_part=${encodeURIComponent(part)}`)
        .join('')}${name.trim() ? `&name=${encodeURIComponent(name.trim())}` : ''}`,
      { schema: exercisePageSchema, signal },
    ),
  bodyParts: (signal?: AbortSignal) =>
    apiClient.get('/api/v1/exercises/body-parts', { schema: bodyPartsSchema, signal }),
  exercise: (id: number, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/exercises/${id}`, { schema: exerciseSchema, signal }),
  save: (input: RoutineInput, id?: number) =>
    id === undefined
      ? apiClient.post('/api/v1/routines', routineInputSchema.parse(input), {
          schema: routineSchema,
        })
      : apiClient.patch(`/api/v1/routines/${id}`, routineInputSchema.parse(input), {
          schema: routineSchema,
        }),
};
