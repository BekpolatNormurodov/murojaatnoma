import { Injectable, NotFoundException } from '@nestjs/common';
import { EmployeeSalary } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpsertSalaryDto } from './dto/upsert-salary.dto';

export interface SalaryDto {
  id: string;
  employeeId: string;
  year: number;
  month: number;
  amount: number;
  bonus: number;
  penalty: number;
  net: number;
  note: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** One employee's row in the monthly salary roster (salary may be unset). */
export interface SalaryRosterRow {
  employeeId: string;
  fullName: string;
  position: string;
  avatarUrl: string | null;
  salary: SalaryDto | null;
}

@Injectable()
export class SalariesService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(s: EmployeeSalary): SalaryDto {
    return {
      id: s.id,
      employeeId: s.employeeId,
      year: s.year,
      month: s.month,
      amount: s.amount,
      bonus: s.bonus,
      penalty: s.penalty,
      net: s.amount + s.bonus - s.penalty,
      note: s.note,
      paidAt: s.paidAt,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  private now(): { year: number; month: number } {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }

  /**
   * Monthly roster for the web-admin salary table: every active employee joined
   * with their salary for (year, month) — `salary` is null where none is set yet.
   */
  async monthlyRoster(year?: number, month?: number): Promise<{
    year: number;
    month: number;
    rows: SalaryRosterRow[];
    totalNet: number;
  }> {
    const period = { year: year ?? this.now().year, month: month ?? this.now().month };
    const employees = await this.prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        position: true,
        avatarUrl: true,
        salaries: { where: { year: period.year, month: period.month }, take: 1 },
      },
      orderBy: { fullName: 'asc' },
    });

    let totalNet = 0;
    const rows: SalaryRosterRow[] = employees.map((e) => {
      const salary = e.salaries[0] ? this.serialize(e.salaries[0]) : null;
      if (salary) {
        totalNet += salary.net;
      }
      return {
        employeeId: e.id,
        fullName: e.fullName,
        position: e.position,
        avatarUrl: e.avatarUrl,
        salary,
      };
    });

    return { year: period.year, month: period.month, rows, totalNet };
  }

  /** Full salary history for one employee (newest month first). */
  async history(employeeId: string): Promise<SalaryDto[]> {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    const rows = await this.prisma.employeeSalary.findMany({
      where: { employeeId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    return rows.map((r) => this.serialize(r));
  }

  /** An employee's own salary — the whole history, or one month if given. */
  async mine(employeeId: string, year?: number, month?: number): Promise<SalaryDto[]> {
    const rows = await this.prisma.employeeSalary.findMany({
      where: {
        employeeId,
        ...(year ? { year } : {}),
        ...(month ? { month } : {}),
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    return rows.map((r) => this.serialize(r));
  }

  /** Create or replace one employee's salary for a month. */
  async upsert(dto: UpsertSalaryDto): Promise<SalaryDto> {
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    const base = {
      amount: dto.amount,
      bonus: dto.bonus ?? 0,
      penalty: dto.penalty ?? 0,
      note: dto.note ?? null,
    };
    const row = await this.prisma.employeeSalary.upsert({
      where: {
        employeeId_year_month: {
          employeeId: dto.employeeId,
          year: dto.year,
          month: dto.month,
        },
      },
      // On edit, only touch paidAt when the caller sends it — otherwise a plain
      // amount edit must NOT wipe an already-recorded payment date.
      update: { ...base, ...(dto.paidAt !== undefined ? { paidAt: new Date(dto.paidAt) } : {}) },
      create: {
        employeeId: dto.employeeId,
        year: dto.year,
        month: dto.month,
        ...base,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : null,
      },
    });
    return this.serialize(row);
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.employeeSalary.delete({ where: { id } });
    } catch {
      throw new NotFoundException('Salary record not found');
    }
  }
}
