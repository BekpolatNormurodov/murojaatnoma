import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { NewsItem } from '@/shared/data/types';

/**
 * Yangiliklar va e'lonlar ro'yxatini backend'dan oladi: GET /api/news
 * Javob shakli mock'dagi `NEWS: NewsItem[]` bilan bir xil (drop-in).
 */
export function useNews() {
  return useQuery({
    queryKey: ['news'],
    queryFn: () => api.get<NewsItem[]>('/news'),
    staleTime: 30_000,
  });
}
