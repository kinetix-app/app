import { apiClient } from '@/services/apiClient';

import { nutritionApi } from './api';
import { nutritionGoalSchema } from './schemas';

afterEach(() => {
  jest.restoreAllMocks();
});

test('loads the authenticated users nutrition goal', async () => {
  const get = jest.spyOn(apiClient, 'get').mockResolvedValue({
    id: 1,
    user_id: 1,
    calories: '9999.00',
    protein: '500.00',
    carbohydrates: '1200.00',
    fats: '350.00',
  });

  await expect(nutritionApi.goal()).resolves.toMatchObject({
    calories: '9999.00',
    protein: '500.00',
  });
  expect(get).toHaveBeenCalledWith('/api/v1/nutrition-goals/me', {
    schema: expect.any(Object),
    signal: undefined,
  });
});

test('accepts decimal values serialized by the API as strings', () => {
  expect(
    nutritionGoalSchema.parse({
      id: 1,
      user_id: 1,
      calories: '9999.00',
      protein: '500.00',
      carbohydrates: '1200.00',
      fats: '350.00',
    }),
  ).toMatchObject({ calories: 9999, protein: 500, carbohydrates: 1200, fats: 350 });
});
