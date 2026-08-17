import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { NotificationItem } from '@/shared/data/types';

/**
 * Admin panel bildirishnomalari ro'yxatini backend'dan oladi: GET /api/notifications
 * Javob shakli mock'dagi `NOTIFICATIONS: NotificationItem[]` bilan bir xil (drop-in).
 */
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<NotificationItem[]>('/notifications'),
    staleTime: 30_000,
  });
}

/**
 * O'qilmagan bildirishnomalar sonini oladi: GET /api/notifications/unread-count
 * Panel yopiq holatdayoq (ro'yxat hali yuklanmagan bo'lsa ham) belgi sonini
 * ko'rsatish uchun ishlatiladi.
 */
export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    staleTime: 30_000,
  });
}
