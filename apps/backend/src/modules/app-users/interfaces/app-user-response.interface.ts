import { AppUserDevice, AppUserStatus } from '@prisma/client';

/**
 * Daily activity point (sparkline). Mirrors web-admin's
 * `AppUserActivityPoint` from shared/data/types.ts. Stored as a Prisma
 * `Json` column on `AppUser.activity`.
 */
export interface AppUserActivityPoint {
  date: string; // ISO date (YYYY-MM-DD)
  count: number;
}

/**
 * Drop-in shape for web-admin's `AppUser` (shared/data/types.ts). Field
 * names/order match the Prisma `AppUser` model 1:1 except `registeredAt`/
 * `lastActiveAt` are serialized as ISO strings and `activity` is narrowed
 * from `Prisma.JsonValue` to `AppUserActivityPoint[]`.
 */
export interface AppUserResponse {
  id: string;
  name: string;
  phone: string;
  photo: string;
  avatarColor: string;
  region: string;
  districtId: string;
  address: string;
  device: AppUserDevice;
  appVersion: string;
  status: AppUserStatus;
  verified: boolean;
  registeredAt: string;
  lastActiveAt: string;
  requestsCount: number;
  resolvedCount: number;
  avgRating: number;
  points: number;
  notificationsOn: boolean;
  activity: AppUserActivityPoint[];
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
