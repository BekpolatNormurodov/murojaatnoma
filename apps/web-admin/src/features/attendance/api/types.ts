/* ============================================================
   Davomat (Attendance) — backend javob tiplari
   GET /api/attendance/today va /api/attendance/report/monthly
   ============================================================ */

export type TodayAttendanceStatus = 'present' | 'late' | 'absent' | 'left';

export interface TodayCheckIn {
  time: string; // ISO datetime
  isLate: boolean;
  lateMinutes: number;
  insideGeofence: boolean;
}

export interface TodayCheckOut {
  time: string; // ISO datetime
}

export interface EmployeeTodayEntry {
  employeeId: string;
  fullName: string;
  position: string;
  department: string | null;
  checkIn: TodayCheckIn | null;
  checkOut: TodayCheckOut | null;
  status: TodayAttendanceStatus;
  hoursWorked: number | null;
}

export interface TodayAttendanceSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  left: number;
}

export interface TodayAttendance {
  date: string;
  roster: EmployeeTodayEntry[];
  summary: TodayAttendanceSummary;
}

/* ------------------------------------------------------------
   Oylik hisobot (GET /api/attendance/report/monthly) — ixtiyoriy
   trend bo'limi uchun ishlatiladi.
   ------------------------------------------------------------ */
export interface EmployeeDailySummary {
  employeeId: string;
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
}

export interface AttendanceMonthlyReport {
  from: string;
  to: string;
  totalRecords: number;
  perEmployee: EmployeeDailySummary[];
  absentees: ReportAbsentee[];
}
