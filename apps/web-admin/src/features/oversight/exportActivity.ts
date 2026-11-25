import { api, ApiError } from '@/shared/api/client';
import { exportWorkbook } from '@/shared/lib/export';
import { buildActivityReport, type ExportFilter } from './activitySheets';
import { daysInclusive, localDay, MAX_DAILY_DAYS, type Range } from './period';
import { fetchActivity, fetchActivityDaily } from './useActivity';
import type { OversightData } from './useOversight';

/**
 * Excel: tanlangan davr uchun ma'lumotni yig'adi va yuklab beradi. /oversight va
 * "Kunlik hisobotlar" sahifalari shu bitta funksiyadan foydalanadi.
 */
export async function exportActivityWorkbook({
  range,
  filter,
  note,
}: {
  range: Range;
  filter?: ExportFilter;
  note?: string;
}): Promise<{ employees: number; dailyMissing: string | null }> {
  const [year, month] = range.to.split('-').map(Number);
  const [activity, oversight, daily] = await Promise.all([
    fetchActivity(range.from, range.to),
    api.get<OversightData>(`/oversight?year=${year}&month=${month}`),
    daysInclusive(range.from, range.to) > MAX_DAILY_DAYS
      ? null
      : fetchActivityDaily(range.from, range.to).catch((e: unknown) => {
          // Eski serverda bu manzil yo'q — qolgan varaqlar baribir chiqadi.
          // Boshqa xato: chala faylni jimgina bermaymiz.
          if (e instanceof ApiError && e.status === 404) return null;
          throw e;
        }),
  ]);
  const report = buildActivityReport({ range, today: localDay(), activity, daily, oversight, filter, note });
  await exportWorkbook(`xodimlar_faollik_${range.from}_${range.to}`, report.sheets);
  return { employees: report.employees, dailyMissing: report.dailyMissing };
}
