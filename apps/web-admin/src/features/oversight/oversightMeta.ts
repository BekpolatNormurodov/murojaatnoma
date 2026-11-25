import type { OversightRow } from './useOversight.ts';

export type AttMeta = { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'primary' };

const ATT_META: Record<OversightRow['attendance']['status'], AttMeta> = {
  present: { label: 'Ish joyida', tone: 'success' },
  late: { label: 'Kechikkan', tone: 'warning' },
  left: { label: 'Chiqib ketgan', tone: 'neutral' },
  absent: { label: 'Kelmagan', tone: 'danger' },
  leave: { label: "Ta'tilda", tone: 'primary' },
  dayoff: { label: 'Dam olish', tone: 'neutral' },
};

/**
 * Backend yangi holat qo'shsa ham sahifa qulamasin: dam olish kuni `dayoff`
 * kelganda butun /oversight "undefined.tone" bilan yiqilgan edi.
 */
export function attMeta(status: string): AttMeta {
  return (ATT_META as Record<string, AttMeta | undefined>)[status] ?? { label: "Noma'lum", tone: 'neutral' };
}
