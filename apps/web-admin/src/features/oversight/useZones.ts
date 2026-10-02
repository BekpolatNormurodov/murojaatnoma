import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

/** One mahalla from GET /api/zones?kind=mahalla (70 real Mirzo Ulug'bek mahallas). */
export interface Mahalla {
  code: string;
  nameUzLat: string;
  nameUzCyr: string | null;
}

/** Mahalla ro'yxati (hudud biriktirish uchun) — kam o'zgaradi, uzoq keshlanadi. */
export function useMahallas() {
  return useQuery({
    // ['zones','mahalla'] is the map's GeoJSON (dashboard + Jonli xarita) —
    // sharing that key handed this list a FeatureCollection, so after the
    // dashboard was opened "Hudud biriktirish" showed "Mahalla topilmadi".
    queryKey: ['zones', 'mahalla', 'list'],
    queryFn: () => api.get<Mahalla[]>('/zones?kind=mahalla'),
    staleTime: 60 * 60_000,
  });
}

/**
 * Xodimga mahalla(lar) biriktirish (hudud nazorati): PATCH /api/employees/:id
 * { assignedMahallaCodes }. Muvaffaqiyatdan so'ng nazorat jadvali qayta so'raladi.
 */
export function useAssignZones() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, mahallaCodes }: { employeeId: string; mahallaCodes: string[] }) =>
      api.patch(`/employees/${employeeId}`, { assignedMahallaCodes: mahallaCodes }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['oversight'] });
      void qc.invalidateQueries({ queryKey: ['employee-profile'] });
    },
  });
}
