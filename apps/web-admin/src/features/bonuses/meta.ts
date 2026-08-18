import { Edit2, Profile2User, SecurityUser, type Icon as IconType } from 'iconsax-react';
import type { Bonus } from './useBonuses';

/** Qabul qiluvchi manbai — "Premya yozish" oynasidagi tanlov. */
export type RecipientSource = 'worker' | 'staff' | 'custom';

export const SOURCE_META: Record<
  RecipientSource,
  { label: string; icon: IconType; tone: 'success' | 'info' | 'neutral' }
> = {
  worker: { label: 'Ishchi', icon: Profile2User, tone: 'success' },
  staff: { label: 'Xodim', icon: SecurityUser, tone: 'info' },
  custom: { label: 'Erkin nom', icon: Edit2, tone: 'neutral' },
};

/** Bonus yozuvidan qaysi manbadan berilganini aniqlaydi (badge uchun). */
export function bonusSource(bonus: Pick<Bonus, 'employeeId' | 'workerId'>): RecipientSource {
  if (bonus.employeeId) return 'staff';
  if (bonus.workerId) return 'worker';
  return 'custom';
}

const MONTHS_FULL = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
];

/** "2026-08" -> "Avgust 2026". Kutilmagan formatda xom qiymatni qaytaradi. */
export function formatMonthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month ?? '');
  if (!m) return month || '—';
  const idx = Number(m[2]) - 1;
  const name = MONTHS_FULL[idx];
  return name ? `${name} ${m[1]}` : month;
}

/** Joriy oy "YYYY-MM" formatida (forma uchun standart qiymat). */
export function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
