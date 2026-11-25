/* ============================================================
   Hisobotlar ro'yxatini sahifalab yuklash (limit / offset).
   ============================================================ */

/** Bir so'rovda nechta hisobot. */
export const REPORT_PAGE_SIZE = 200;

/**
 * Sahifalarni birlashtiradi. Orada yangi hisobot kelsa offset suriladi va
 * bitta yozuv ikki sahifada chiqishi mumkin — `id` bo'yicha bir marta olinadi.
 */
export function mergeReportPages<T extends { id: string }>(pages: T[][]): T[] {
  const seen = new Map<string, T>();
  for (const page of pages) {
    for (const r of Array.isArray(page) ? page : []) if (!seen.has(r.id)) seen.set(r.id, r);
  }
  return [...seen.values()];
}

/**
 * Keyingi sahifaning offset'i; undefined — boshqa yo'q. To'la sahifa
 * (uzunligi == limit) davomi borligini bildiradi. Yangi `id` qo'shmagan sahifa
 * (offset'ni bilmaydigan eski server) ham oxiri hisoblanadi.
 */
export function nextReportOffset<T extends { id: string }>(pages: T[][], size = REPORT_PAGE_SIZE): number | undefined {
  const last = pages[pages.length - 1];
  if (!Array.isArray(last) || last.length !== size) return undefined;
  if (pages.length > 1 && mergeReportPages(pages).length === mergeReportPages(pages.slice(0, -1)).length) {
    return undefined;
  }
  return pages.reduce((n, p) => n + p.length, 0);
}
