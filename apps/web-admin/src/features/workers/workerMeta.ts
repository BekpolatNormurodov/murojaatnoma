import type { WorkerStatus } from '@/shared/data/types';

/**
 * Hokimiyat lavozimlari — "Ishchi qo'shish/tahrirlash" oynasidagi "Lavozim"
 * qidiruvli ro'yxati uchun yagona manba (tartib saqlangan holda).
 */
export const WORKER_POSITIONS: string[] = [
  "Hokim",
  "Hokim birinchi o'rinbosari",
  "Hokim o'rinbosari",
  "Mas'ul kotib",
  "Devonxona mudiri",
  "Bosh mutaxassis",
  "Yetakchi mutaxassis",
  "Mutaxassis",
  "Iqtisodiyot va moliya bo'limi boshlig'i",
  "Investitsiyalar va tashqi savdo bo'limi boshlig'i",
  "Yer resurslari va kadastr bo'limi boshlig'i",
  "Qurilish bo'limi boshlig'i",
  "Kommunal xo'jalik bo'limi boshlig'i",
  "Obodonlashtirish bo'limi boshlig'i",
  "Ijtimoiy himoya bo'limi boshlig'i",
  "Ta'lim bo'limi boshlig'i",
  "Sog'liqni saqlash bo'limi boshlig'i",
  "Madaniyat bo'limi boshlig'i",
  "Jismoniy tarbiya va sport bo'limi boshlig'i",
  "Yoshlar siyosati bo'limi boshlig'i",
  "Mahalla va oilani qo'llab-quvvatlash bo'limi boshlig'i",
  "Xotin-qizlar masalalari bo'yicha maslahatchi",
  "Murojaatlar bilan ishlash bo'limi boshlig'i",
  "Kadrlar bo'limi boshlig'i",
  "Yuridik bo'lim boshlig'i",
  "Axborot xizmati rahbari",
  "Matbuot kotibi",
  "Ichki audit bo'limi boshlig'i",
  "Tadbirkorlikni rivojlantirish bo'limi boshlig'i",
  "Qishloq xo'jaligi bo'limi boshlig'i",
  "Ekologiya va atrof-muhit bo'limi boshlig'i",
  "Transport va yo'l xo'jaligi bo'limi boshlig'i",
  "Savdo va xizmat ko'rsatish bo'limi boshlig'i",
  "Turizmni rivojlantirish bo'limi boshlig'i",
  "Statistika bo'limi boshlig'i",
  "Raqamlashtirish (IT) bo'limi boshlig'i",
  "Arxiv mudiri",
  "Hujjatlar bilan ishlash inspektori",
  "Fuqarolar yig'ini raisi",
  "Referent",
];

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
