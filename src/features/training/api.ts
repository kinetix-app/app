import { apiClient } from '@/services/apiClient';
import {
  exerciseConfigurationSchema,
  draftSnapshotSchema,
  serverDraftSchema,
  type DraftSnapshot,
  completionInputSchema,
  completedSessionSchema,
  sessionPageSchema,
  type CompletionInput,
  type WeightUnit,
  exercisePageSchema,
  exerciseSchema,
  bodyPartsSchema,
  routineInputSchema,
  routinePageSchema,
  routineSchema,
  type RoutineInput,
} from './schemas';

export const trainingApi = {
  draft: (signal?: AbortSignal) =>
    apiClient.get('/api/v1/session-drafts', { schema: serverDraftSchema.nullable(), signal }),
  saveDraft: (id: string, input: DraftSnapshot, signal?: AbortSignal) =>
    apiClient.put(`/api/v1/session-drafts/${id}`, draftSnapshotSchema.parse(input), {
      schema: serverDraftSchema,
      signal,
    }),
  discardDraft: (id: string, signal?: AbortSignal) =>
    apiClient.delete(`/api/v1/session-drafts/${id}`, { signal }),
  finishDraft: (id: string, endedAt: string, signal?: AbortSignal, updateRoutine = false) =>
    apiClient.post(
      `/api/v1/session-drafts/${id}/finish`,
      { ended_at: endedAt, update_routine: updateRoutine },
      { schema: completedSessionSchema, signal },
    ),
  complete: (input: CompletionInput, signal?: AbortSignal) =>
    apiClient.post('/api/v1/sessions', completionInputSchema.parse(input), {
      schema: completedSessionSchema,
      signal,
    }),
  sessions: (offset: number, unit: WeightUnit, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/sessions?limit=50&offset=${offset}&weight_unit=${unit}`, {
      schema: sessionPageSchema,
      signal,
    }),
  session: (id: number, unit: WeightUnit, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/sessions/${id}?weight_unit=${unit}`, {
      schema: completedSessionSchema,
      signal,
    }),

  routines: (offset: number, signal?: AbortSignal, name = '') => {
    const trimmedName = name.trim();
    const nameParam = trimmedName ? `&name=${encodeURIComponent(trimmedName)}` : '';
    return apiClient.get(`/api/v1/routines?limit=20&offset=${offset}${nameParam}`, {
      schema: routinePageSchema,
      signal,
    });
  },
  routine: (id: number, signal?: AbortSignal, unit: WeightUnit = 'kg') =>
    apiClient.get(`/api/v1/routines/${id}?weight_unit=${unit}`, { schema: routineSchema, signal }),
  exercises: (bodyParts: string[], offset: number, signal?: AbortSignal, name = '') => {
    const bodyPartParams = [...new Set(bodyParts.map((part) => part.trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((part) => queryParameter('body_part', part))
      .join('');
    const trimmedName = name.trim();
    const nameParam = trimmedName ? queryParameter('name', trimmedName) : '';
    return apiClient.get(
      `/api/v1/exercises?limit=20&offset=${offset}${bodyPartParams}${nameParam}`,
      { schema: exercisePageSchema, signal },
    );
  },
  bodyParts: (signal?: AbortSignal) =>
    apiClient.get('/api/v1/exercises/body-parts', {
      schema: bodyPartsSchema,
      signal,
    }),
  lastConfiguration: (id: number, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/exercises/${id}/last-configuration?weight_unit=kg`, {
      schema: exerciseConfigurationSchema,
      signal,
    }),
  exercise: (id: number, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/exercises/${id}`, {
      schema: exerciseSchema,
      signal,
    }),
  save: (input: RoutineInput, id?: number) =>
    id === undefined
      ? apiClient.post('/api/v1/routines', routineInputSchema.parse(input), {
          schema: routineSchema,
        })
      : apiClient.patch(`/api/v1/routines/${id}`, routineInputSchema.parse(input), {
          schema: routineSchema,
        }),
};

function queryParameter(name: string, value: string) {
  return `&${name}=${encodeURIComponent(value)}`;
}
