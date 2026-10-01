import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { useRealtime } from '@/shared/realtime/RealtimeProvider';
import type { NotificationItem } from '@/shared/data/types';

const LIST_KEY = ['notifications'] as const;
const COUNT_KEY = ['notifications', 'unread-count'] as const;

/**
 * Admin panel bildirishnomalari: GET /api/notifications — real hodisalardan
 * (yangi murojaat/shikoyat, muddati o'tdi, past baho, qayta ochildi …).
 * Yangisi socket orqali (`admin:notification`) jonli keladi.
 */
export function useNotifications() {
  const qc = useQueryClient();
  const { socket } = useRealtime();
  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    };
    socket.on('admin:notification', refresh);
    return () => {
      socket.off('admin:notification', refresh);
    };
  }, [socket, qc]);

  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () => api.get<NotificationItem[]>('/notifications'),
    staleTime: 30_000,
  });
}

/** O'qilmagan soni (ro'yxat yuklanmasdan badge uchun). */
export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: COUNT_KEY,
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    staleTime: 30_000,
  });
}

/** Bittasini o'qilgan qilish — serverda saqlanadi (optimistik). */
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/admin/${encodeURIComponent(id)}/read`),
    onMutate: (id) => {
      qc.setQueryData<NotificationItem[]>(LIST_KEY, (prev) =>
        prev?.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: COUNT_KEY });
    },
  });
}

/** Hammasini o'qilgan qilish. */
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/notifications/admin/read-all'),
    onMutate: () => {
      qc.setQueryData<NotificationItem[]>(LIST_KEY, (prev) => prev?.map((n) => ({ ...n, read: true })));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: COUNT_KEY });
    },
  });
}
