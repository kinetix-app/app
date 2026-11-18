import { useInfiniteQuery } from '@tanstack/react-query';

import { nutritionApi } from './api';

export const foodPageSize = 20;

export function useFoodCatalogue(search: string, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: ['nutrition', 'foods', 'pages', search],
    enabled,
    initialPageParam: 0,
    queryFn: ({ signal, pageParam }) =>
      nutritionApi.foodPage(search, pageParam, foodPageSize + 1, signal),
    getNextPageParam: (page, _, offset) =>
      page.length > foodPageSize ? offset + foodPageSize : undefined,
  });
  return {
    ...query,
    foods: query.data?.pages.flatMap((page) => page.slice(0, foodPageSize)) ?? [],
  };
}
