import {
  Crown1,
  UserTick,
  Briefcase,
  UserSquare,
  SecurityUser,
  Profile2User,
  type Icon as IconType,
} from 'iconsax-react';
import { ROLE_META, STAFF_STATUS_META } from '@/shared/data/mock';
import type { ModuleKey, StaffRole, StaffStatus } from '@/shared/data/types';

/** Har bir rol uchun ikonka — StaffPage va StaffDetail bir xil manbadan oladi. */
export const ROLE_ICON: Record<StaffRole, IconType> = {
  hokim: Crown1,
  hokim_yordamchisi: UserTick,
  bolim_boshligi: Briefcase,
  operator: UserSquare,
  nazoratchi: SecurityUser,
  ishchi: Profile2User,
};

const FALLBACK_ROLE_META: { label: string; color: string; rank: number; defaults: ModuleKey[] } = {
  label: "Noma'lum rol",
  color: '#94a3b8',
  rank: 99,
  defaults: [],
};
const FALLBACK_STATUS_META: { label: string; tone: 'success' | 'neutral' | 'danger' } = {
  label: "Noma'lum",
  tone: 'neutral',
};

/**
 * Himoyalangan (guarded) qidiruvlar — backend kutilmagan rol/status
 * qiymati qaytarsa ham (masalan yangi rol qo'shilib, frontend hali
 * yangilanmagan bo'lsa) UI qulamasligi uchun neytral fallback beradi.
 */
export function roleMeta(role: StaffRole) {
  return ROLE_META[role] ?? FALLBACK_ROLE_META;
}

export function staffStatusMeta(status: StaffStatus) {
  return STAFF_STATUS_META[status] ?? FALLBACK_STATUS_META;
}

export function roleIcon(role: StaffRole): IconType {
  return ROLE_ICON[role] ?? Profile2User;
}
