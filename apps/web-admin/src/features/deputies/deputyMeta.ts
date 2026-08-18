import { CATEGORY_META } from '@/shared/data/mock';
import type {
  CitizenRequest,
  Complaint,
  Deputy,
  Meeting,
  RequestCategory,
} from '@/shared/data/types';

const FALLBACK_CATEGORY_META = { label: 'Boshqa', color: '#94a3b8' };

/**
 * Himoyalangan (guarded) qidiruv — CATEGORY_META'da yo'q (kutilmagan)
 * kategoriya uchun neytral fallback beradi, UI qulamasligi uchun.
 */
export function categoryMeta(cat: RequestCategory) {
  return CATEGORY_META[cat] ?? FALLBACK_CATEGORY_META;
}

/** Bitta o'rinbosarga tegishli murojaat/shikoyat/yig'ilish statistikasi. */
export function deputyStats(
  d: Deputy,
  requests: CitizenRequest[],
  complaints: Complaint[],
  meetings: Meeting[],
) {
  const deputyRequests = requests.filter((r) => d.categories.includes(r.category));
  const openRequests = deputyRequests.filter(
    (r) => r.status === 'new' || r.status === 'in_progress',
  ).length;
  const deputyComplaints = complaints.filter((c) => c.deputyId === d.id).length;
  const deputyMeetings = meetings.filter((m) => m.chairDeputyId === d.id).length;
  return {
    requests: deputyRequests.length,
    openRequests,
    complaints: deputyComplaints,
    meetings: deputyMeetings,
  };
}
