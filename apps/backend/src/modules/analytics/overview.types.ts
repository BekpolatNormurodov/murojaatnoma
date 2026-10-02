import { Priority, RequestCategory, RequestStatus } from '@prisma/client';

/**
 * `GET /analytics/overview` — the web-admin Boshqaruv paneli in ONE request,
 * computed from live data only (citizen murojaats + legacy requests, real
 * employees, attendance, live locations, mahalla zones). No padding constants
 * and no hard-coded trend: every number on the dashboard comes from here.
 */
export interface OverviewResponse {
  generatedAt: string;
  murojaat: MurojaatKpis;
  trend: { daily: TrendPoint[]; monthly: TrendPoint[] };
  /** Qachon yozishadi: soat (0..23) va hafta kuni (Du..Ya) — oxirgi 90 kun. */
  activity: { byHour: number[]; byWeekday: number[] };
  /** Oxirgi 7 kun davomati (eski → yangi), ish kunlari bo'yicha. */
  attendanceWeek: AttendanceDayPoint[];
  categories: CategoryLoad[];
  workforce: WorkforceKpis;
  topEmployees: EmployeeLoad[];
  mahallas: MahallaLoad[];
  pins: MurojaatPin[];
  recent: RecentMurojaat[];
}

export interface MurojaatKpis {
  total: number;
  new: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  /** new + in_progress */
  open: number;
  /** Open and past their SLA deadline. */
  overdue: number;
  /** Open, deadline within the next 24 h. */
  dueSoon: number;
  /** New citizen murojaats nobody has been assigned to yet. */
  unassigned: number;
  /** resolved / (resolved + rejected + open), % (null when nothing yet). */
  resolutionRate: number | null;
  /** Share of resolved murojaats closed within their SLA, %. */
  slaRate: number | null;
  avgResolutionHours: number | null;
  avgRating: number | null;
  ratedCount: number;
  /** Rolling windows for honest period-over-period deltas. */
  created30: number;
  createdPrev30: number;
  resolved30: number;
  resolvedPrev30: number;
  /** Open murojaats by priority. */
  openByPriority: Record<Priority, number>;
  bySource: { citizen: number; legacy: number };
  /** Ariza va shikoyat — jami va ochiq. */
  byKind: { ariza: { total: number; open: number }; shikoyat: { total: number; open: number } };
  /**
   * SLA ning tarkibi: muddatida hal qilingan, kechikib hal qilingan va
   * muddati o'tib hali ochiq. slaRate = onTime / (onTime + late + overdueOpen).
   */
  sla: { onTime: number; late: number; overdueOpen: number };
}

export interface AttendanceDayPoint {
  date: string;
  label: string;
  isWorkday: boolean;
  onTime: number;
  late: number;
  absent: number;
  onLeave: number;
  total: number;
}

export interface TrendPoint {
  /** YYYY-MM-DD (daily) or YYYY-MM (monthly), local time. */
  key: string;
  label: string;
  created: number;
  resolved: number;
}

export interface CategoryLoad {
  category: RequestCategory;
  total: number;
  open: number;
}

export interface WorkforceKpis {
  total: number;
  /** Valid check-in today. */
  checkedIn: number;
  lateToday: number;
  /** Active employees with no check-in today. */
  notCheckedIn: number;
  /** Reported a location within the stale window. */
  reportingNow: number;
  /** Reporting AND inside their assigned territory (or the office). */
  insideZone: number;
  /** Reporting but outside their assigned territory. */
  outsideZone: number;
  /** Was reporting, has gone silent. */
  stale: number;
  neverReported: number;
  staleMinutes: number;
  /** Today's on-time share among those who checked in, %. */
  onTimeRate: number | null;
}

export interface EmployeeLoad {
  id: string;
  fullName: string;
  position: string;
  avatarUrl: string | null;
  open: number;
  overdue: number;
  resolved: number;
  avgRating: number | null;
}

export interface MahallaLoad {
  code: string;
  name: string;
  total: number;
  open: number;
  overdue: number;
}

export interface MurojaatPin {
  id: string;
  title: string;
  status: RequestStatus;
  priority: Priority;
  category: RequestCategory;
  lat: number;
  lng: number;
  overdue: boolean;
  createdAt: string;
  mahallaCode: string | null;
}

export interface RecentMurojaat {
  id: string;
  title: string;
  category: RequestCategory;
  status: RequestStatus;
  priority: Priority;
  citizenName: string;
  address: string;
  createdAt: string;
  dueAt: string | null;
  overdue: boolean;
  source: 'citizen' | 'legacy';
  kind: 'ariza' | 'shikoyat' | null;
  assignee: { id: string; fullName: string; avatarUrl: string | null } | null;
}
