import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { nutritionApi } from './api';

const foodPageSize = 20;

export function useFoodCatalogue(search: string, enabled = true) {
  const [page, setPage] = useState({ search, visibleCount: foodPageSize });
  const visibleCount = page.search === search ? page.visibleCount : foodPageSize;
  if (page.search !== search) setPage({ search, visibleCount: foodPageSize });

  const query = useQuery({
    queryKey: ['nutrition', 'foods', 'catalogue', search],
    enabled,
    queryFn: ({ signal }) =>
      search ? nutritionApi.searchFoods(search, signal) : nutritionApi.foods(signal),
  });
  const foods = query.data ?? [];
  return {
    ...query,
    foods: foods.slice(0, visibleCount),
    hasNextPage: foods.length > visibleCount,
    showMore: () =>
      setPage((current) => ({ ...current, visibleCount: current.visibleCount + foodPageSize })),
  };
}
