import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceType, EmployeeRole, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AttendanceService, TodayAttendanceStatus } from '../attendance/attendance.service';
import { formatLocalDate } from '../attendance/utils/date.util';
import { LocationsService } from '../locations/locations.service';
import { SalariesService } from '../salaries/salaries.service';
import { UpsertEmployeeDto } from './dto/upsert-employee.dto';

const REGION = 'Toshkent shahri';
const DISTRICT = 'Mirzo Ulug‘bek';

/** One employee's live oversight snapshot: face + attendance + territory + salary. */
export interface OversightRow {
  employeeId: string;
  fullName: string;
  position: string;
  avatarUrl: string | null;
  /** Has the employee enrolled a face template (worker-app biometric check-in)? */
  hasFace: boolean;
  attendance: {
    status: TodayAttendanceStatus;
    checkInAt: Date | null;
    checkOutAt: Date | null;
    isLate: boolean;
    /** Hours worked TODAY (bugun necha soat). */
    hoursWorked: number | null;
    /** Total hours worked THIS MONTH (bu oy necha soat). */
    monthHours: number;
  };
  location: {
    hasLocation: boolean;
    insideAssignedZone: boolean;
    mahallaName: string | null;
    isStale: boolean;
  };
  /** Mahalla codes this employee is assigned to (empty = whole district). */
  assignedMahallaCodes: string[];
  /** Net salary for the requested month (null when unset). */
  salaryNet: number | null;
  /** BASE salary (`EmployeeSalary.amount`, before bonus/penalty) for the month — what the edit form edits. */
  salaryBase: number | null;
  /** Total premya (bonus) awarded this month (so'm). */
  premyaThisMonth: number;
}

export interface OversightSummary {
  total: number;
  faceEnrolled: number;
  presentNow: number;
  lateNow: number;
  outsideZone: number;
  salaryTotalNet: number;
}

/**
 * Hokimiyat nazorati — a single read-only aggregation over existing services
 * (attendance, locations, salaries) plus face-enrollment, so the web-admin can
 * show every employee's face / keldi-ketdi / hudud / oylik in one table without
 * four separate round-trips. Aggregates in memory from three bulk queries.
 */
@Injectable()
export class OversightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
    private readonly locations: LocationsService,
    private readonly salaries: SalariesService,
  ) {}

  /**
   * Total hours worked this month per employee: pair each local day's first
   * CHECK_IN with its last CHECK_OUT and sum. Approximate (same local-day bucket
   * as the daily report) — enough for a "bu oy necha soat" figure.
   */
  private async monthHoursByEmployee(year: number, month: number): Promise<Map<string, number>> {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);
    const records = await this.prisma.attendanceRecord.findMany({
      where: { recordedAt: { gte: from, lt: to } },
      select: { employeeId: true, type: true, recordedAt: true },
      orderBy: { recordedAt: 'asc' },
    });
    const perDay = new Map<string, { in: Date | null; out: Date | null }>();
    for (const r of records) {
      const key = `${r.employeeId}|${formatLocalDate(r.recordedAt)}`;
      const e = perDay.get(key) ?? { in: null, out: null };
      if (r.type === AttendanceType.CHECK_IN) {
        if (!e.in) {
          e.in = r.recordedAt;
        }
      } else if (r.type === AttendanceType.CHECK_OUT) {
        e.out = r.recordedAt;
      }
      perDay.set(key, e);
    }
    const hours = new Map<string, number>();
    for (const [key, e] of perDay) {
      if (e.in && e.out && e.out > e.in) {
        const h = (e.out.getTime() - e.in.getTime()) / 3_600_000;
        const emp = key.slice(0, key.indexOf('|'));
        hours.set(emp, (hours.get(emp) ?? 0) + h);
      }
    }
    for (const [k, v] of hours) {
      hours.set(k, Math.round(v * 10) / 10);
    }
    return hours;
  }

  /** Total premya (bonus) awarded this month, per employee. */
  private async premyaByEmployee(year: number, month: number): Promise<Map<string, number>> {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const grouped = await this.prisma.bonus.groupBy({
      by: ['employeeId'],
      where: { month: monthStr, employeeId: { not: null } },
      _sum: { amount: true },
    });
    const map = new Map<string, number>();
    for (const g of grouped) {
      if (g.employeeId) {
        map.set(g.employeeId, g._sum.amount ?? 0);
      }
    }
    return map;
  }

  async overview(
    year?: number,
    month?: number,
  ): Promise<{ year: number; month: number; rows: OversightRow[]; summary: OversightSummary }> {
    const now = new Date();
    const period = { year: year ?? now.getFullYear(), month: month ?? now.getMonth() + 1 };
    const [today, locs, roster, facedEmployees, monthHours, premya] = await Promise.all([
      this.attendance.today({}),
      this.locations.getLatestForAll(),
      this.salaries.monthlyRoster(period.year, period.month),
      this.prisma.faceTemplate.findMany({ distinct: ['employeeId'], select: { employeeId: true } }),
      this.monthHoursByEmployee(period.year, period.month),
      this.premyaByEmployee(period.year, period.month),
    ]);

    const faceSet = new Set(facedEmployees.map((f) => f.employeeId));
    const attMap = new Map(today.roster.map((a) => [a.employeeId, a]));
    const locMap = new Map(locs.map((l) => [l.employeeId, l]));

    // The salary roster already enumerates every ACTIVE employee (salary may be
    // null), so it's the canonical base list.
    const rows: OversightRow[] = roster.rows.map((base) => {
      const att = attMap.get(base.employeeId);
      const loc = locMap.get(base.employeeId);
      return {
        employeeId: base.employeeId,
        fullName: base.fullName,
        position: base.position,
        avatarUrl: base.avatarUrl,
        hasFace: faceSet.has(base.employeeId),
        attendance: {
          status: att?.status ?? 'absent',
          checkInAt: att?.checkIn?.time ?? null,
          checkOutAt: att?.checkOut?.time ?? null,
          isLate: att?.checkIn?.isLate ?? false,
          hoursWorked: att?.hoursWorked ?? null,
          monthHours: monthHours.get(base.employeeId) ?? 0,
        },
        location: {
          hasLocation: loc?.hasLocation ?? false,
          insideAssignedZone: loc?.insideAssignedZone ?? true,
          mahallaName: loc?.mahallaName ?? null,
          isStale: loc?.isStale ?? true,
        },
        assignedMahallaCodes: loc?.assignedMahallaCodes ?? [],
        salaryNet: base.salary?.net ?? null,
        salaryBase: base.salary?.amount ?? null,
        premyaThisMonth: premya.get(base.employeeId) ?? 0,
      };
    });

    const summary: OversightSummary = {
      total: rows.length,
      faceEnrolled: rows.filter((r) => r.hasFace).length,
      presentNow: rows.filter((r) => r.attendance.status === 'present').length,
      lateNow: rows.filter((r) => r.attendance.status === 'late').length,
      outsideZone: rows.filter((r) => r.location.hasLocation && !r.location.insideAssignedZone).length,
      salaryTotalNet: roster.totalNet,
    };

    return { year: roster.year, month: roster.month, rows, summary };
  }

  /**
   * Create a NEW employee (person) from the web-admin Nazorat page: worker-app
   * login (username+password), optional photo, current-month salary, territory.
   */
  async createEmployee(dto: UpsertEmployeeDto): Promise<{ id: string; fullName: string; username: string | null }> {
    if (!dto.username || !dto.password) {
      throw new ConflictException('Yangi xodim uchun username va parol majburiy');
    }
    const phone = dto.phone?.trim() || (await this.nextPlaceholderPhone());
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const emp = await this.prisma.employee.create({
        data: {
          fullName: dto.fullName,
          position: dto.position,
          phone,
          region: REGION,
          district: DISTRICT,
          role: EmployeeRole.EMPLOYEE,
          isActive: true,
          username: dto.username,
          passwordHash,
          avatarUrl: dto.avatarUrl ?? null,
          assignedMahallaCodes: dto.assignedMahallaCodes ?? [],
        },
      });
      if (dto.salary != null) {
        await this.setSalary(emp.id, dto.salary, dto.salaryYear, dto.salaryMonth);
      }
      return { id: emp.id, fullName: emp.fullName, username: emp.username };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const t = (e.meta?.target as string[] | undefined) ?? [];
        throw new ConflictException(`Bu ${t.includes('username') ? 'username' : t.includes('phone') ? 'telefon' : 'qiymat'} band`);
      }
      throw e;
    }
  }

  /** Edit an existing employee (name/position/photo/password/salary/territory). */
  async updateEmployee(id: string, dto: UpsertEmployeeDto): Promise<{ id: string; fullName: string }> {
    const existing = await this.prisma.employee.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      throw new NotFoundException('Xodim topilmadi');
    }
    const data: Prisma.EmployeeUncheckedUpdateInput = {
      fullName: dto.fullName,
      position: dto.position,
      ...(dto.phone ? { phone: dto.phone.trim() } : {}),
      ...(dto.username ? { username: dto.username } : {}),
      ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      ...(dto.assignedMahallaCodes !== undefined ? { assignedMahallaCodes: dto.assignedMahallaCodes } : {}),
    };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    try {
      await this.prisma.employee.update({ where: { id }, data });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('username yoki telefon band');
      }
      throw e;
    }
    if (dto.salary != null) {
      await this.setSalary(id, dto.salary, dto.salaryYear, dto.salaryMonth);
    }
    return { id, fullName: dto.fullName };
  }

  /**
   * Upsert the BASE salary (`amount`) for the given month — the month the admin
   * is viewing in Nazorat (defaults to the current one). bonus/penalty are left
   * untouched, so saving an edit never folds them into the base.
   */
  private async setSalary(employeeId: string, amount: number, year?: number, month?: number): Promise<void> {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth() + 1;
    await this.prisma.employeeSalary.upsert({
      where: { employeeId_year_month: { employeeId, year: y, month: m } },
      update: { amount },
      create: { employeeId, year: y, month: m, amount },
    });
  }

  /**
   * `Employee.phone` is required + unique, but an admin may add someone without
   * a phone. Use the non-dialable `+99800…` range (no Uzbek operator code 00),
   * so a placeholder can never ring a real stranger from the map's call button.
   * Random suffix + existence check — one query per try, no sequential scan.
   */
  private async nextPlaceholderPhone(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const phone = `+99800${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`;
      const exists = await this.prisma.employee.findUnique({ where: { phone }, select: { id: true } });
      if (!exists) {
        return phone;
      }
    }
    throw new ConflictException("Vaqtinchalik telefon raqamini yaratib bo'lmadi — telefonni kiriting");
  }
}
