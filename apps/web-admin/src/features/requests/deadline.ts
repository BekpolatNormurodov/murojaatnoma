import type { CitizenRequest, RequestCategory } from "@/shared/data/types";

/* ============================================================
   Murojaatni hal qilish muddati (SLA) — turiga qarab
   Standart 15 kun; shoshilinch turlar uchun qisqaroq,
   keng ko'lamli ishlar uchun uzunroq.
   ============================================================ */
export const CATEGORY_SLA: Record<RequestCategory, number> = {
  elektr: 7, // elektr ta'minoti — shoshilinch
  suv: 7, // suv ta'minoti — shoshilinch
  tozalik: 10, // tozalik
  kommunal: 15, // standart muddat
  yol: 20, // yo'l ta'mirlash
  obodonlashtirish: 30, // obodonlashtirish — keng ko'lamli
};

export const DEFAULT_SLA = 15;

const DAY = 86_400_000;
const HOUR = 3_600_000;

export type Urgency = "overdue" | "critical" | "warning" | "ok" | "done";

export interface DeadlineInfo {
  /** Tur bo'yicha berilgan muddat (kun). */
  slaDays: number;
  /** Tugash sanasi. */
  dueAt: Date;
  /** Qolgan to'liq kun (manfiy = kechikkan). */
  daysLeft: number;
  /** Qolgan soat. */
  hoursLeft: number;
  /** Muddati o'tganmi (faqat ochiq murojaatlar uchun). */
  overdue: boolean;
  /** Shoshilinchlik darajasi. */
  urgency: Urgency;
  /** Sarflangan vaqt ulushi 0..1. */
  progress: number;
  /** Qisqa yorliq: "5 kun qoldi" | "2 kun kechikdi". */
  label: string;
  /** Murojaat yopilganmi (resolved/rejected). */
  done: boolean;
}

/** Murojaatning muddat holatini hisoblaydi. */
export function getDeadline(
  r: CitizenRequest,
  t: (key: string) => string,
  now: number = Date.now(),
): DeadlineInfo {
  const slaDays = CATEGORY_SLA[r.category] ?? DEFAULT_SLA;
  const created = new Date(r.createdAt).getTime();
  const dueMs = created + slaDays * DAY;
  const dueAt = new Date(dueMs);
  const done = r.status === "resolved" || r.status === "rejected";

  if (done) {
    const end = r.resolvedAt ? new Date(r.resolvedAt).getTime() : now;
    const onTime = end <= dueMs;
    return {
      slaDays,
      dueAt,
      daysLeft: 0,
      hoursLeft: 0,
      overdue: !onTime,
      urgency: "done",
      progress: 1,
      label: onTime ? t("common.deadline.onTime") : t("common.deadline.lateDone"),
      done: true,
    };
  }

  const remainMs = dueMs - now;
  const daysLeft = Math.ceil(remainMs / DAY);
  const hoursLeft = Math.round(remainMs / HOUR);
  const overdue = remainMs < 0;
  const progress = Math.max(0, Math.min(1, (now - created) / (slaDays * DAY)));

  let urgency: Urgency;
  if (overdue) urgency = "overdue";
  else if (daysLeft <= 2) urgency = "critical";
  else if (daysLeft <= 5) urgency = "warning";
  else urgency = "ok";

  const label = overdue
    ? t("common.deadline.overdueTemplate").replace("{days}", String(Math.abs(daysLeft)))
    : daysLeft <= 0
      ? t("common.deadline.dueToday")
      : t("common.deadline.remainingTemplate").replace("{days}", String(daysLeft));

  return {
    slaDays,
    dueAt,
    daysLeft,
    hoursLeft,
    overdue,
    urgency,
    progress,
    label,
    done: false,
  };
}

/** Shoshilinchlik darajasi uchun rang va stillar (til-mustaqil qism). */
const URGENCY_STYLE: Record<
  Urgency,
  {
    color: string;
    /** Matn rangi (tailwind). */
    text: string;
    /** Yumshoq fon (tailwind). */
    soft: string;
    /** Chegara rangi (tailwind). */
    border: string;
    /** Qizil "yonish" (pulse) animatsiyasi qo'llanilsinmi. */
    glow: boolean;
  }
> = {
  overdue: {
    color: "#ef4444",
    text: "text-red-700",
    soft: "bg-danger-soft",
    border: "border-red-300",
    glow: true,
  },
  critical: {
    color: "#f97316",
    text: "text-orange-600",
    soft: "bg-orange-100",
    border: "border-orange-300",
    glow: true,
  },
  warning: {
    color: "#f59e0b",
    text: "text-amber-700",
    soft: "bg-warning-soft",
    border: "border-amber-200",
    glow: false,
  },
  ok: {
    color: "#10b981",
    text: "text-primary-700",
    soft: "bg-success-soft",
    border: "border-line",
    glow: false,
  },
  done: {
    color: "#64748b",
    text: "text-ink-soft",
    soft: "bg-surface-2",
    border: "border-line",
    glow: false,
  },
};

const URGENCY_LABEL_KEY: Record<Urgency, string> = {
  overdue: "common.deadline.overdueStatus",
  critical: "common.deadline.critical",
  warning: "common.deadline.approaching",
  ok: "common.deadline.onTimeStatus",
  done: "common.deadline.finished",
};

/** Shoshilinchlik darajasi uchun rang, stil va tarjima qilingan label. */
export function urgencyMeta(u: Urgency, t: (key: string) => string) {
  return { ...URGENCY_STYLE[u], label: t(URGENCY_LABEL_KEY[u]) };
}

/** Faqat ochiq (hal qilinmagan) murojaatlar uchun true. */
export function isOpen(r: CitizenRequest): boolean {
  return r.status === "new" || r.status === "in_progress";
}
