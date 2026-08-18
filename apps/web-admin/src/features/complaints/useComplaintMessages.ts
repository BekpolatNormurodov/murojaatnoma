import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

/**
 * Shikoyat suhbatiga biriktirilgan bitta media. Murojaat (Application)
 * `Attachment` shakli bilan bir xil — mijozlar bir xil kodni ulasha oladi:
 * `type` faqat PHOTO|VIDEO (ovozli xabar ham VIDEO sifatida saqlanadi, aniq
 * turi `mimeType` bo'yicha ajratiladi). `url` doimiy (nginx `/uploads/`).
 */
export interface ComplaintAttachment {
  id: string;
  type: 'PHOTO' | 'VIDEO';
  url: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

/**
 * Shikoyat suhbatidagi bitta xabar — admin/fuqaro/xodim yozgan matn va/yoki
 * biriktirilgan media. `text` bo'sh bo'lishi mumkin (faqat media yuborilganda).
 */
export interface ComplaintMessage {
  id: string;
  authorType: string; // "ADMIN" | "CITIZEN" | "STAFF" ...
  authorName: string;
  text?: string | null;
  createdAt: string; // ISO
  attachments: ComplaintAttachment[];
}

/** Suhbat xabarlari uchun react-query kaliti. */
const messagesKey = (id: string | null) => ['complaint-messages', id] as const;

/**
 * GET /complaints/:id/messages — suhbat xabarlari (biriktirilgan media bilan,
 * `createdAt` bo'yicha o'sish tartibida). `id` bo'lmasa so'rov yuborilmaydi.
 */
export function useComplaintMessages(id: string | null) {
  return useQuery({
    queryKey: messagesKey(id),
    queryFn: () => api.get<ComplaintMessage[]>(`/complaints/${id}/messages`),
    enabled: !!id,
    staleTime: 15_000,
  });
}

/**
 * POST /complaints/:id/messages — multipart/form-data (`text` ixtiyoriy +
 * ixtiyoriy `file`). Faylni murojaat yuklamasi kabi backend `UPLOADS_DIR` ga
 * saqlaydi va xabarga bog'langan `ComplaintAttachment` yaratadi. Muvaffaqiyatda
 * suhbat ro'yxati (messagesKey) invalidatsiya qilinadi — yangi xabar darhol
 * ko'rinadi. Content-Type qo'yilmaydi (brauzer multipart chegarasini o'zi
 * belgilaydi); Authorization + 401 refresh — `api.upload` ichida.
 */
export function useSendComplaintMessage(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ text, file }: { text?: string; file?: File | null }) => {
      const fd = new FormData();
      const trimmed = text?.trim();
      if (trimmed) fd.append('text', trimmed);
      if (file) fd.append('file', file);
      return api.upload<ComplaintMessage>(`/complaints/${id}/messages`, fd);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: messagesKey(id) });
    },
  });
}
