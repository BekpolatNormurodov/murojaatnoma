/* ============================================================
   Davomat (Attendance) — backend javob tiplari
   GET /api/attendance/today va /api/attendance/report/monthly
   ============================================================ */

export type TodayAttendanceStatus = 'present' | 'late' | 'absent' | 'left';

// Fields marked optional arrived with the richer davomat board — older
// backends simply omit them and the UI hides those details.

export interface TodayCheckIn {
  time: string; // ISO datetime
  isLate: boolean;
  lateMinutes: number;
  insideGeofence: boolean;
  /** Face match score of the accepted scan, 0..1. */
  faceScore?: number;
  /** Metres from the office point at scan time. */
  distanceM?: number;
}

export interface TodayCheckOut {
  time: string; // ISO datetime
  insideGeofence?: boolean;
  faceScore?: number;
  distanceM?: number;
}

/** A scan the server rejected (face below threshold and/or outside the geofence). */
export interface TodayFailedScan {
  type: 'CHECK_IN' | 'CHECK_OUT';
  time: string;
  reason: string | null;
  faceScore: number;
  distanceM: number;
}

export interface TodayLiveLocation {
  at: string;
  mahallaName: string | null;
  insideZone: boolean;
  stale: boolean;
}

export interface EmployeeTodayEntry {
  employeeId: string;
  fullName: string;
  position: string;
  phone?: string;
  avatarUrl: string | null;
  department: string | null;
  workStartTime?: string;
  workEndTime?: string;
  checkIn: TodayCheckIn | null;
  checkOut: TodayCheckOut | null;
  status: TodayAttendanceStatus;
  hoursWorked: number | null;
  earlyLeaveMinutes?: number;
  failedScans?: TodayFailedScan[];
  live?: TodayLiveLocation | null;
}

export interface TodayAttendanceSummary {
  total: number;
  /** Checked in on time and still working. */
  present: number;
  /** Checked in late and still working (late people who left count as `left`). */
  late: number;
  absent: number;
  left: number;
  checkedIn?: number;
  workingNow?: number;
  /** Every late arrival today, including those who already left. */
  lateTotal?: number;
  onTime?: number;
  earlyLeave?: number;
  withFailedScans?: number;
}

export interface TodayAttendance {
  date: string;
  roster: EmployeeTodayEntry[];
  summary: TodayAttendanceSummary;
  workStartTime?: string;
  workEndTime?: string;
}

/* ------------------------------------------------------------
   Oylik hisobot (GET /api/attendance/report/monthly) — ixtiyoriy
   trend bo'limi uchun ishlatiladi.
   ------------------------------------------------------------ */
export interface EmployeeDailySummary {
  employeeId: string;
  fullName: string;
  position: string;
  avatarUrl: string | null;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  validScans: number;
  invalidScans: number;
  lateCount: number;
  lateMinutes: number;
  isLate: boolean;
}

export interface ReportAbsentee {
  employeeId: string;
  fullName: string;
  position: string;
  avatarUrl: string | null;
}

export interface AttendanceMonthlyReport {
  from: string;
  to: string;
  totalRecords: number;
  perEmployee: EmployeeDailySummary[];
  absentees: ReportAbsentee[];
}
