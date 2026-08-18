import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

/**
 * Premya (bonus) yozuvi — backend `BonusResponse` bilan bir xil shakl.
 * `employeeId` — StaffMember (xodim), `workerId` — Worker (dala ishchisi)
 * bo'lsa to'ldiriladi; ikkalasi ham bo'lmasa erkin (qo'lda) kiritilgan
 * qabul qiluvchi degani.
 */
export interface Bonus {
  id: string;
  employeeId: string | null;
  workerId: string | null;
  recipientName: string;
  amount: number;
  reason: string;
  month: string; // "YYYY-MM"
  type: string; // "premya" (standart)
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601 (tahrirlangan bo'lsa createdAt'dan farq qiladi)
}

/**
 * Premyalar ro'yxati: GET /bonuses (ixtiyoriy ?month=YYYY-MM filtri bilan).
 * Backend eng yangisidan boshlab qaytaradi (newest first), oddiy massiv
 * (Paginated<T> emas) — mock'siz, to'g'ridan-to'g'ri backend javobi.
 */
export function useBonuses(month?: string) {
  return useQuery({
    queryKey: ['bonuses', month ?? 'all'] as const,
    queryFn: () =>
      api.get<Bonus[]>(`/bonuses${month ? `?month=${encodeURIComponent(month)}` : ''}`),
    staleTime: 15_000,
  });
}
