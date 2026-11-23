import { useInfiniteQuery } from '@tanstack/react-query';

import { nutritionApi } from './api';

const pageSize = 20;

type PageRequest<T> = (
  search: string,
  offset: number,
  limit: number,
  signal: AbortSignal,
) => Promise<T[]>;

function useCatalogue<T>(
  collection: 'foods' | 'recipes',
  fetchPage: PageRequest<T>,
  search: string,
  enabled: boolean,
) {
  const query = useInfiniteQuery({
    queryKey: ['nutrition', collection, 'pages', search],
    enabled,
    initialPageParam: 0,
    queryFn: ({ signal, pageParam }) => fetchPage(search, pageParam, pageSize + 1, signal),
    getNextPageParam: (page, _, offset) => (page.length > pageSize ? offset + pageSize : undefined),
  });

  return {
    items: query.data?.pages.flatMap((page) => page.slice(0, pageSize)) ?? [],
    isPending: query.isPending,
    isError: query.isError,
    isFetchingNextPage: query.isFetchingNextPage,
    loadMore() {
      if (enabled && query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) {
        void query.fetchNextPage({ cancelRefetch: false });
      }
    },
    retry() {
      if (query.isFetchNextPageError) {
        void query.fetchNextPage({ cancelRefetch: false });
      } else {
        void query.refetch();
      }
    },
  };
}

export function useFoodCatalogue(search: string, enabled: boolean) {
  return useCatalogue('foods', nutritionApi.foodPage, search, enabled);
}

export function useRecipeCatalogue(search: string, enabled: boolean) {
  return useCatalogue('recipes', nutritionApi.recipePage, search, enabled);
}
