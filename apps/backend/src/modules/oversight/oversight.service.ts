import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApplicationEventType,
  ApplicationKind,
  ApplicationStatus,
  AttendanceType,
  EmployeeRole,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AttendanceService, MeWeekEntry, TodayAttendanceStatus } from '../attendance/attendance.service';
import { formatLocalDate } from '../attendance/utils/date.util';
import { LocationsService } from '../locations/locations.service';
import { SalariesService } from '../salaries/salaries.service';
import { EmployeeMurojaatQueryDto, UpsertEmployeeDto } from './dto/upsert-employee.dto';

const REGION = 'Toshkent shahri';
const DISTRICT = 'Mirzo Ulug‘bek';

/** One employee's live oversight snapshot: face + attendance + territory + salary. */
export interface OversightRow {
  employeeId: string;
  fullName: string;
  position: string;
  avatarUrl: string | null;
  /** worker-app login (null = not provisioned) — shown/edited in the Nazorat form. */
  username: string | null;
  /** Contact phone (may be an auto-generated `+99800…` placeholder). */
  phone: string;
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

export interface ArchivedEmployee {
  employeeId: string;
  fullName: string;
  position: string;
  avatarUrl: string | null;
  phone: string;
  username: string | null;
  department: string | null;
  archivedAt: Date;
  archiveReason: string | null;
}

export interface EmployeeMurojaatSummary {
  assigned: number;
  open: number;
  overdue: number;
  resolved: number;
  rejected: number;
  /** Distinct murojaats the employee wrote at least one reply on. */
  answered: number;
  avgRating: number | null;
  avgFirstReplyHours: number | null;
}

export interface EmployeeMurojaatRow {
  id: string;
  title: string;
  kind: ApplicationKind;
  category: string | null;
  status: ApplicationStatus;
  citizenName: string;
  createdAt: Date;
  dueAt: Date | null;
  resolvedAt: Date | null;
  rating: number | null;
  reopenCount: number;
  assignedToThem: boolean;
  replies: number;
  lastReplyAt: Date | null;
  overdue: boolean;
}

export interface EmployeeProfile {
  employeeId: string;
  fullName: string;
  position: string;
  department: string | null;
  phone: string;
  username: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  archivedAt: Date | null;
  archiveReason: string | null;
  createdAt: Date;
  workStartTime: string;
  workEndTime: string;
  office: { lat: number; lng: number; radiusM: number } | null;
  assignedMahallas: { code: string; name: string }[];
  face: { enrolled: boolean; templates: number; lastAt: Date | null };
  live: { at: Date; mahallaName: string | null; insideZone: boolean; stale: boolean } | null;
  month: {
    year: number;
    month: number;
    daysWorked: number;
    lateDays: number;
    lateMinutes: number;
    hours: number;
    absentDays: number;
    salaryBase: number | null;
    salaryNet: number | null;
    premya: number;
  };
  attendance: MeWeekEntry[];
  murojaat: EmployeeMurojaatSummary;
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
    const [today, locs, roster, facedEmployees, monthHours, premya, accounts] = await Promise.all([
      this.attendance.today({}),
      this.locations.getLatestForAll(),
      this.salaries.monthlyRoster(period.year, period.month),
      this.prisma.faceTemplate.findMany({ distinct: ['employeeId'], select: { employeeId: true } }),
      this.monthHoursByEmployee(period.year, period.month),
      this.premyaByEmployee(period.year, period.month),
      this.prisma.employee.findMany({ select: { id: true, username: true, phone: true } }),
    ]);
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

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
        username: accountMap.get(base.employeeId)?.username ?? null,
        phone: accountMap.get(base.employeeId)?.phone ?? '',
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
      throw new BadRequestException('Yangi xodim uchun username va parol majburiy');
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
          departmentId: (await this.departmentIdFor(dto.department)) ?? null,
          ...(dto.workStartTime ? { workStartTime: dto.workStartTime } : {}),
          ...(dto.workEndTime ? { workEndTime: dto.workEndTime } : {}),
          ...this.officeData(dto),
        },
      });
      if (dto.salary != null) {
        await this.setSalary(emp.id, dto.salary, dto.salaryYear, dto.salaryMonth);
      }
      return { id: emp.id, fullName: emp.fullName, username: emp.username };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const t = (e.meta?.target as string[] | undefined) ?? [];
        throw new ConflictException(
          t.includes('username')
            ? 'Bu username band — boshqasini tanlang'
            : t.includes('phone')
              ? 'Bu telefon raqami boshqa xodimda bor'
              : 'Bu qiymat band',
        );
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
      ...(dto.department !== undefined ? { departmentId: await this.departmentIdFor(dto.department) } : {}),
      ...(dto.workStartTime ? { workStartTime: dto.workStartTime } : {}),
      ...(dto.workEndTime ? { workEndTime: dto.workEndTime } : {}),
      ...this.officeData(dto),
    };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    try {
      await this.prisma.employee.update({ where: { id }, data });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const t = (e.meta?.target as string[] | undefined) ?? [];
        throw new ConflictException(
          t.includes('username') ? 'Bu username band — boshqasini tanlang' : 'Bu telefon raqami boshqa xodimda bor',
        );
      }
      throw e;
    }
    if (dto.salary != null) {
      await this.setSalary(id, dto.salary, dto.salaryYear, dto.salaryMonth);
    }
    return { id, fullName: dto.fullName };
  }

  /** `undefined` = don't touch; '' = no department; a name = find or create it. */
  private async departmentIdFor(name?: string): Promise<string | null | undefined> {
    if (name === undefined) return undefined;
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) return null;
    const found = await this.prisma.department.findFirst({
      where: { name: { equals: clean, mode: 'insensitive' } },
      select: { id: true },
    });
    if (found) return found.id;
    const slug =
      clean
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'bolim';
    const created = await this.prisma.department.create({
      data: { name: clean, code: `${slug}-${Date.now().toString(36)}` },
    });
    return created.id;
  }

  /** Personal office point: all three together, or `null`s to fall back to the shared office. */
  private officeData(dto: UpsertEmployeeDto): {
    officeLat?: number | null;
    officeLng?: number | null;
    officeRadiusM?: number | null;
  } {
    if (dto.officeLat === undefined && dto.officeLng === undefined && dto.officeRadiusM === undefined) return {};
    const set = dto.officeLat != null && dto.officeLng != null;
    return set
      ? { officeLat: dto.officeLat, officeLng: dto.officeLng, officeRadiusM: dto.officeRadiusM ?? 200 }
      : { officeLat: null, officeLng: null, officeRadiusM: null };
  }

  /** Bo'limlar — forma uchun tanlov ro'yxati (xodimlar soni bilan). */
  async departments(): Promise<{ id: string; name: string; employees: number }[]> {
    const rows = await this.prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, _count: { select: { employees: { where: { isActive: true } } } } },
    });
    return rows.map((d) => ({ id: d.id, name: d.name, employees: d._count.employees }));
  }

  /** Ishdan bo'shatilganlar (arxiv) — eng yangisi birinchi. */
  async archived(): Promise<ArchivedEmployee[]> {
    const rows = await this.prisma.employee.findMany({
      where: { isActive: false },
      orderBy: [{ archivedAt: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        fullName: true,
        position: true,
        avatarUrl: true,
        phone: true,
        username: true,
        archivedAt: true,
        archiveReason: true,
        updatedAt: true,
        department: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      employeeId: r.id,
      fullName: r.fullName,
      position: r.position,
      avatarUrl: r.avatarUrl,
      phone: r.phone,
      username: r.username,
      department: r.department?.name ?? null,
      archivedAt: r.archivedAt ?? r.updatedAt,
      archiveReason: r.archiveReason,
    }));
  }

  /**
   * Ishdan bo'shatish: login yopiladi (isActive=false, sessiyalar bekor), hamma
   * ro'yxatlardan yashiriladi, lekin tarix (davomat, murojaat, oylik) qoladi.
   * Ochiq murojaatlari biriktirilmagan holatga qaytadi — boshqasiga berish uchun.
   */
  async archive(id: string, reason?: string): Promise<{ id: string; releasedMurojaats: number }> {
    await this.mustExist(id);
    const [, , released] = await this.prisma.$transaction([
      this.prisma.employee.update({
        where: { id },
        data: { isActive: false, archivedAt: new Date(), archiveReason: reason?.trim() || null },
      }),
      this.prisma.refreshToken.updateMany({ where: { employeeId: id, revoked: false }, data: { revoked: true } }),
      this.prisma.application.updateMany({
        where: { assignedEmployeeId: id, status: { in: [ApplicationStatus.NEW, ApplicationStatus.IN_PROGRESS] } },
        data: { assignedEmployeeId: null, status: ApplicationStatus.NEW },
      }),
    ]);
    return { id, releasedMurojaats: released.count };
  }

  /** Arxivdan qaytarish — login yana ishlaydi. */
  async restore(id: string): Promise<{ id: string }> {
    await this.mustExist(id);
    await this.prisma.employee.update({
      where: { id },
      data: { isActive: true, archivedAt: null, archiveReason: null },
    });
    return { id };
  }

  /**
   * Butunlay o'chirish — faqat arxivdagi xodim (avval ishdan bo'shatiladi).
   * Davomat, lokatsiya, yuz shablonlari bilan birga ketadi; murojaatlar
   * qoladi (mas'ul bo'sh bo'ladi).
   */
  async purge(id: string): Promise<void> {
    const emp = await this.mustExist(id);
    if (emp.isActive) {
      throw new BadRequestException("Avval xodimni ishdan bo'shating (arxivga) — keyin butunlay o'chirish mumkin");
    }
    await this.prisma.employee.delete({ where: { id } });
  }

  /** Yuz shablonlarini o'chiradi — xodim ilovada yuzini qayta ro'yxatdan o'tkazadi. */
  async resetFace(id: string): Promise<{ removed: number }> {
    await this.mustExist(id);
    const { count } = await this.prisma.faceTemplate.deleteMany({ where: { employeeId: id } });
    return { removed: count };
  }

  private async mustExist(id: string): Promise<{ id: string; isActive: boolean }> {
    const emp = await this.prisma.employee.findUnique({ where: { id }, select: { id: true, isActive: true } });
    if (!emp) throw new NotFoundException('Xodim topilmadi');
    return emp;
  }

  /**
   * Bitta xodimning to'liq profili (web-admin ichki sahifasi): ma'lumotlar,
   * ish tartibi, hudud, yuz, jonli joy, bu oy ko'rsatkichlari, oxirgi 31 kun
   * davomati (skan rasmlari bilan) va murojaatlar xulosasi.
   */
  async profile(id: string): Promise<EmployeeProfile> {
    const emp = await this.prisma.employee.findUnique({
      where: { id },
      include: { department: { select: { name: true } } },
    });
    if (!emp) throw new NotFoundException('Xodim topilmadi');
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    const [faces, zones, history, salary, premya, murojaat] = await Promise.all([
      this.prisma.faceTemplate.findMany({
        where: { employeeId: id },
        orderBy: { enrolledAt: 'desc' },
        select: { enrolledAt: true },
      }),
      emp.assignedMahallaCodes.length
        ? this.prisma.zone.findMany({
            where: { code: { in: emp.assignedMahallaCodes } },
            select: { code: true, nameUzLat: true },
          })
        : Promise.resolve([]),
      this.attendance.history(id, 31),
      this.prisma.employeeSalary.findUnique({
        where: { employeeId_year_month: { employeeId: id, year, month } },
      }),
      this.premyaByEmployee(year, month),
      this.murojaatSummary(id),
    ]);

    const monthDays = history.filter((d) => d.date.startsWith(monthKey));
    const worked = monthDays.filter((d) => d.checkIn);
    const zoneName = new Map(zones.map((z) => [z.code, z.nameUzLat]));
    const staleMs = 30 * 60_000;

    return {
      employeeId: emp.id,
      fullName: emp.fullName,
      position: emp.position,
      department: emp.department?.name ?? null,
      phone: emp.phone,
      username: emp.username,
      avatarUrl: emp.avatarUrl,
      isActive: emp.isActive,
      archivedAt: emp.archivedAt,
      archiveReason: emp.archiveReason,
      createdAt: emp.createdAt,
      workStartTime: emp.workStartTime,
      workEndTime: emp.workEndTime,
      office:
        emp.officeLat != null && emp.officeLng != null
          ? { lat: emp.officeLat, lng: emp.officeLng, radiusM: emp.officeRadiusM ?? 200 }
          : null,
      assignedMahallas: emp.assignedMahallaCodes.map((code) => ({ code, name: zoneName.get(code) ?? code })),
      face: { enrolled: faces.length > 0, templates: faces.length, lastAt: faces[0]?.enrolledAt ?? null },
      live: emp.lastLocationAt
        ? {
            at: emp.lastLocationAt,
            mahallaName: emp.lastMahallaName,
            insideZone: emp.lastInsideAssignedZone,
            stale: now.getTime() - emp.lastLocationAt.getTime() > staleMs,
          }
        : null,
      month: {
        year,
        month,
        daysWorked: worked.length,
        lateDays: worked.filter((d) => d.checkIn?.isLate).length,
        lateMinutes: worked.reduce((s, d) => s + (d.checkIn?.lateMinutes ?? 0), 0),
        hours: Math.round(monthDays.reduce((s, d) => s + (d.hoursWorked ?? 0), 0) * 10) / 10,
        absentDays: monthDays.filter((d) => d.status === 'absent').length,
        salaryBase: salary?.amount ?? null,
        salaryNet: salary ? salary.amount + salary.bonus - salary.penalty : null,
        premya: premya.get(id) ?? 0,
      },
      attendance: history,
      murojaat,
    };
  }

  /** Xodimning murojaatlar ko'rsatkichlari (biriktirilgan + o'zi javob yozgan). */
  private async murojaatSummary(id: string): Promise<EmployeeMurojaatSummary> {
    const [assigned, answeredIds] = await Promise.all([
      this.prisma.application.findMany({
        where: { assignedEmployeeId: id },
        select: { status: true, dueAt: true, rating: true },
      }),
      this.answeredIds(id),
    ]);
    const now = Date.now();
    const open = assigned.filter((a) => a.status === ApplicationStatus.NEW || a.status === ApplicationStatus.IN_PROGRESS);
    const rated = assigned.filter((a) => a.rating != null);
    const firstReply = await this.firstReplyHours(id);
    return {
      assigned: assigned.length,
      open: open.length,
      overdue: open.filter((a) => a.dueAt && a.dueAt.getTime() < now).length,
      resolved: assigned.filter((a) => a.status === ApplicationStatus.RESOLVED).length,
      rejected: assigned.filter((a) => a.status === ApplicationStatus.REJECTED).length,
      answered: answeredIds.size,
      avgRating: rated.length
        ? Math.round((rated.reduce((s, a) => s + (a.rating ?? 0), 0) / rated.length) * 10) / 10
        : null,
      avgFirstReplyHours: firstReply,
    };
  }

  /** Murojaatlar — xodim javob yozgan (MESSAGE hodisasi, actor = shu xodim). */
  private async answeredIds(id: string): Promise<Map<string, { count: number; first: Date; last: Date }>> {
    const events = await this.prisma.applicationEvent.findMany({
      where: { actorEmployeeId: id, type: ApplicationEventType.MESSAGE },
      select: { applicationId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const m = new Map<string, { count: number; first: Date; last: Date }>();
    for (const e of events) {
      const cur = m.get(e.applicationId);
      if (cur) {
        cur.count += 1;
        cur.last = e.createdAt;
      } else {
        m.set(e.applicationId, { count: 1, first: e.createdAt, last: e.createdAt });
      }
    }
    return m;
  }

  /** O'rtacha birinchi javob vaqti (soat): biriktirilgandan birinchi javobigacha. */
  private async firstReplyHours(id: string): Promise<number | null> {
    const [assignedEv, replies] = await Promise.all([
      this.prisma.applicationEvent.findMany({
        where: { toEmployeeId: id, type: ApplicationEventType.ASSIGNED },
        select: { applicationId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.answeredIds(id),
    ]);
    const spans: number[] = [];
    const seen = new Set<string>();
    for (const a of assignedEv) {
      if (seen.has(a.applicationId)) continue;
      seen.add(a.applicationId);
      const r = replies.get(a.applicationId);
      if (r && r.first >= a.createdAt) spans.push((r.first.getTime() - a.createdAt.getTime()) / 3_600_000);
    }
    return spans.length ? Math.round((spans.reduce((s, x) => s + x, 0) / spans.length) * 10) / 10 : null;
  }

  /**
   * Xodimning murojaatlari ro'yxati — filtr: kimniki (biriktirilgan / javob
   * yozgan / hal qilgan), holat, tur, oxirgi N kun.
   */
  async murojaats(id: string, q: EmployeeMurojaatQueryDto): Promise<EmployeeMurojaatRow[]> {
    await this.mustExist(id);
    const answered = await this.answeredIds(id);
    const scope = q.scope ?? 'all';
    const since = q.days ? new Date(Date.now() - q.days * 86_400_000) : undefined;
    const answeredList = [...answered.keys()];
    const who: Prisma.ApplicationWhereInput =
      scope === 'assigned'
        ? { assignedEmployeeId: id }
        : scope === 'answered'
          ? { id: { in: answeredList } }
          : scope === 'resolved'
            ? { assignedEmployeeId: id, status: ApplicationStatus.RESOLVED }
            : { OR: [{ assignedEmployeeId: id }, { id: { in: answeredList } }] };
    const rows = await this.prisma.application.findMany({
      where: {
        AND: [
          who,
          q.status ? { status: q.status as ApplicationStatus } : {},
          q.kind ? { kind: q.kind as ApplicationKind } : {},
          since ? { createdAt: { gte: since } } : {},
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true,
        subject: true,
        kind: true,
        category: true,
        status: true,
        applicantFullName: true,
        createdAt: true,
        dueAt: true,
        resolvedAt: true,
        rating: true,
        reopenCount: true,
        assignedEmployeeId: true,
      },
    });
    const now = Date.now();
    return rows.map((r) => {
      const a = answered.get(r.id);
      const open = r.status === ApplicationStatus.NEW || r.status === ApplicationStatus.IN_PROGRESS;
      return {
        id: r.id,
        title: r.subject.replace(/^\[(ARIZA|SHIKOYAT)\|[^\]]*\]\s*/, '') || r.subject,
        kind: r.kind,
        category: r.category,
        status: r.status,
        citizenName: r.applicantFullName,
        createdAt: r.createdAt,
        dueAt: r.dueAt,
        resolvedAt: r.resolvedAt,
        rating: r.rating,
        reopenCount: r.reopenCount,
        assignedToThem: r.assignedEmployeeId === id,
        replies: a?.count ?? 0,
        lastReplyAt: a?.last ?? null,
        overdue: open && !!r.dueAt && r.dueAt.getTime() < now,
      };
    });
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
