import { apiClient } from '@/services/apiClient';

import { nutritionGoalSchema } from './schemas';

export const nutritionApi = {
  goal: (signal?: AbortSignal) =>
    apiClient.get('/api/v1/nutrition-goals/me', { schema: nutritionGoalSchema, signal }),
};
