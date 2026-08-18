import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

/**
 * Murojaat harakatlar tarixi (audit) — backend `ApplicationEvent` (nomlar bilan).
 * `GET /applications/:id/events` — yaratilgan, holat o'zgargan, xodim
 * biriktirilgan va izoh (message) hodisalari vaqt tartibida.
 */
export interface RequestEvent {
  id: string;
  type: 'CREATED' | 'STATUS_CHANGED' | 'ASSIGNED' | 'MESSAGE';
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
  actorName: string | null;
  fromEmployeeName: string | null;
  toEmployeeName: string | null;
  departmentName: string | null;
}

export function useRequestEvents(id: string | null) {
  return useQuery({
    queryKey: ['request-events', id],
    queryFn: () => api.get<RequestEvent[]>(`/applications/${id}/events`),
    enabled: !!id,
    staleTime: 30_000,
  });
}
