/**
 * Xodim hozir qayerda — uch holat: biriktirilgan hududida, ofisda yoki
 * tashqarida. Hudud ustun; ofis hudud hisoblanmaydi, alohida holat.
 */
export type Territory = 'zone' | 'office' | 'outside';

export function territoryOf(insideZone: boolean | null | undefined, insideOffice?: boolean | null): Territory {
  if (insideZone) return 'zone';
  return insideOffice ? 'office' : 'outside';
}

export const TERRITORY_LABEL: Record<Territory, string> = {
  zone: 'Hududda',
  office: 'Ofisda',
  outside: 'Tashqarida',
};
