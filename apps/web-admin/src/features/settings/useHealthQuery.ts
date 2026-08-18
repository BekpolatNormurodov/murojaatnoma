import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

/**
 * Backend health-check: GET /health (@Public, DB ping bilan).
 * "Tizim" tabidagi "Server holati" / "Ma'lumotlar bazasi" qatorlari
 * shu haqiqiy javob asosida ko'rsatiladi — statik "Faol" matni emas.
 */
export interface HealthStatus {
  status: 'ok' | 'error';
  uptimeSeconds: number;
  database: 'up' | 'down';
  timestamp: string;
}

export function useHealthQuery() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<HealthStatus>('/health'),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}

/** Soniyani "2 soat 14 daqiqa" ko'rinishiga o'giradi. */
export function formatUptime(seconds: number, t: (key: string) => string): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const hoursSuffix = t("settings.system.uptimeHoursSuffix");
  const minutesSuffix = t("settings.system.uptimeMinutesSuffix");
  if (h <= 0 && m <= 0) return t("settings.system.uptimeLessThanMinute");
  if (h <= 0) return `${m} ${minutesSuffix}`;
  if (m <= 0) return `${h} ${hoursSuffix}`;
  return `${h} ${hoursSuffix} ${m} ${minutesSuffix}`;
}
