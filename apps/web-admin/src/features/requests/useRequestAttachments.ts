import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

/**
 * Murojaatga biriktirilgan media — backend `Attachment`. `type` faqat
 * PHOTO|VIDEO (ovozli xabar ham VIDEO sifatida saqlanadi; aniq turi
 * `mimeType` bo'yicha ajratiladi). Fayl `url` doimiy (nginx `/uploads/`).
 */
export interface Attachment {
  id: string;
  applicationId: string;
  type: 'PHOTO' | 'VIDEO';
  url: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  uploadedAt: string;
}

/**
 * GET /applications/:id/attachments — murojaatga (mobil ilovadan yoki fuqaro
 * tomonidan) yuklangan media ro'yxatini oladi. `id` bo'lmasa so'rov yubormaydi.
 */
export function useRequestAttachments(id: string | null) {
  return useQuery({
    queryKey: ['request-attachments', id],
    queryFn: () => api.get<Attachment[]>(`/applications/${id}/attachments`),
    enabled: !!id,
    staleTime: 30_000,
  });
}
