import { CATEGORY_META, COMPLAINTS, MEETINGS, REQUESTS } from '@/shared/data/mock';
import type { Deputy, RequestCategory } from '@/shared/data/types';

const FALLBACK_CATEGORY_META = { label: 'Boshqa', color: '#94a3b8' };

/**
 * Himoyalangan (guarded) qidiruv — CATEGORY_META'da yo'q (kutilmagan)
 * kategoriya uchun neytral fallback beradi, UI qulamasligi uchun.
 */
export function categoryMeta(cat: RequestCategory) {
  return CATEGORY_META[cat] ?? FALLBACK_CATEGORY_META;
}

/** Bitta o'rinbosarga tegishli murojaat/shikoyat/yig'ilish statistikasi. */
export function deputyStats(d: Deputy) {
  const requests = REQUESTS.filter((r) => d.categories.includes(r.category));
  const openRequests = requests.filter(
    (r) => r.status === 'new' || r.status === 'in_progress',
  ).length;
  const complaints = COMPLAINTS.filter((c) => c.deputyId === d.id).length;
  const meetings = MEETINGS.filter((m) => m.chairDeputyId === d.id).length;
  return { requests: requests.length, openRequests, complaints, meetings };
}
