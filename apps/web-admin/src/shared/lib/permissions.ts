import { useAuth, type AdminRole } from "@/shared/store/auth";

/**
 * Rol asosidagi ko'rinish/ruxsat xaritasi.
 *
 * - SUPER_ADMIN — hammasi (shu jumladan Moliya, Sozlamalar va Adminlar).
 * - ADMIN       — operatsion bo'limlar (Moliya/Sozlamalar/Adminlar'dan tashqari), to'liq
 *   yozish (yaratish/tahrirlash/o'chirish) huquqi bilan.
 * - VIEWER      — ADMIN bilan bir xil ko'rinadigan bo'limlar, lekin FAQAT o'qish — yozish
 *   amallari (yaratish/tahrirlash/o'chirish) yashirin yoki bloklangan bo'lishi kerak.
 */
export type Feature =
  | "dashboard"
  | "requests"
  | "complaints"
  | "workers"
  | "staff"
  | "deputies"
  | "attendance"
  | "map"
  | "news"
  | "meetings"
  | "documents"
  | "appUsers"
  | "cameras"
  | "chat"
  | "analytics"
  | "bonuses"
  | "finance"
  | "settings"
  | "adminUsers";

/** ADMIN va VIEWER ko'ra oladigan operatsion bo'limlar. */
const OPERATIONAL_FEATURES: readonly Feature[] = [
  "dashboard",
  "requests",
  "complaints",
  "workers",
  "staff",
  "deputies",
  "attendance",
  "map",
  "news",
  "meetings",
  "documents",
  "appUsers",
  "cameras",
  "chat",
  "analytics",
  "bonuses",
];

/** Faqat SUPER_ADMIN ko'ra oladigan bo'limlar. */
export const SUPER_ADMIN_ONLY_FEATURES: readonly Feature[] = [
  "finance",
  "settings",
  "adminUsers",
];

/** Berilgan rol shu feature'ni ko'ra oladimi (VIEWER — ADMIN bilan bir xil ko'rinish). */
export function can(role: AdminRole | string | null | undefined, feature: Feature): boolean {
  if (role === "SUPER_ADMIN") return true;
  if (role === "ADMIN" || role === "VIEWER") return OPERATIONAL_FEATURES.includes(feature);
  return false;
}

/** Berilgan rol yozish (yaratish/tahrirlash/o'chirish) amallarini bajara oladimi. */
export function canWrite(role: AdminRole | string | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

/**
 * Joriy tizimga kirgan admin uchun ruxsatlar. `can(feature)` — menyu/marshrut ko'rinishi;
 * `canWrite` — VIEWER uchun false, sahifalarda yaratish/tahrirlash/o'chirish tugmalarini
 * shu flag bilan yashirish/bloklash kerak.
 */
export function usePermissions() {
  const role = useAuth((s) => s.user?.role);
  return {
    role,
    can: (feature: Feature) => can(role, feature),
    canWrite: canWrite(role),
    isSuperAdmin: role === "SUPER_ADMIN",
    isViewer: role === "VIEWER",
  };
}
