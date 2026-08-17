/* ============================================================
   Ilova foydalanuvchilari (App Users) — backend javob tiplari
   GET /api/app-users, /api/app-users/stats,
   /api/app-users/dau, /api/app-users/growth
   ============================================================ */

// `AppUser` field-nomlari backend `AppUserResponse` bilan 1:1 mos keladi —
// shu sababli umumiy tipni shared/data/types.ts dan qayta ishlatamiz.
export type { AppUser, AppUserStatus, AppUserDevice, AppUserActivityPoint } from '@/shared/data/types';

/** Generic paginatsiya konverti — backendning umumiy `Paginated<T>` shakli. */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/** Drop-in shape for web-admin's `APP_USER_STATS`. */
export interface AppUserStats {
  total: number;
  active: number;
  inactive: number;
  blocked: number;
  verified: number;
  android: number;
  ios: number;
  totalRequests: number;
  newThisMonth: number;
  avgRating: number;
}

/** Drop-in shape for one entry of web-admin's `APP_USER_DAU`. */
export interface AppUserDauPoint {
  date: string;
  faol: number;
}

/** Drop-in shape for one entry of web-admin's `APP_USER_GROWTH`. */
export interface AppUserGrowthPoint {
  month: string;
  yangi: number;
  jami: number;
}
