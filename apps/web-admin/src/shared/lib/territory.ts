/**
 * Xodim hozir qayerda: biriktirilgan hududida, ofisda yoki tashqarida.
 * Hudud ustun; ofis hudud hisoblanmaydi, alohida holat. Mahalla
 * biriktirilmagan xodim (ofisda bo'lmasa) "tashqarida" ham emas — 'none'.
 */
export type Territory = 'zone' | 'office' | 'outside' | 'none';

export function territoryOf(
  insideZone: boolean | null | undefined,
  insideOffice?: boolean | null,
  /** false = mahalla biriktirilmagan; berilmasa (eski javob) hisobga olinmaydi. */
  hasZones?: boolean,
): Territory {
  if (hasZones === false) return insideOffice ? 'office' : 'none';
  if (insideZone) return 'zone';
  return insideOffice ? 'office' : 'outside';
}

export const TERRITORY_LABEL: Record<Territory, string> = {
  zone: 'Hududda',
  office: 'Ofisda',
  outside: 'Tashqarida',
  none: 'Hudud biriktirilmagan',
};
