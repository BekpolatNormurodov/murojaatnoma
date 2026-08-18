import type { WorkerStatus } from '@/shared/data/types';

/**
 * Ishchi holati (status) uchun label/tone — kartochka va profil
 * (drawer)da bir xil manba ishlatilishi uchun bitta joyda saqlanadi.
 */
export const WORKER_STATUS_META: Record<
  WorkerStatus,
  { label: string; tone: 'success' | 'warning' | 'neutral' | 'info' }
> = {
  online: { label: 'Onlayn', tone: 'success' },
  on_task: { label: 'Vazifada', tone: 'warning' },
  break: { label: 'Tanaffus', tone: 'info' },
  offline: { label: 'Oflayn', tone: 'neutral' },
};

const FALLBACK_STATUS_META = { label: "Noma'lum", tone: 'neutral' as const };

/**
 * Himoyalangan (guarded) qidiruv — backend kutilmagan status qiymati
 * qaytarsa ham UI qulamasligi uchun neytral fallback beradi.
 */
export function workerStatusMeta(status: WorkerStatus) {
  return WORKER_STATUS_META[status] ?? FALLBACK_STATUS_META;
}
