import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { GovDocument } from '@/shared/data/types';

/**
 * Hokimiyat hujjatlari ro'yxatini backend'dan oladi: GET /api/documents
 * Javob shakli mock'dagi `DOCUMENTS: GovDocument[]` bilan bir xil (drop-in).
 */
export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: () => api.get<GovDocument[]>('/documents'),
    staleTime: 30_000,
  });
}
