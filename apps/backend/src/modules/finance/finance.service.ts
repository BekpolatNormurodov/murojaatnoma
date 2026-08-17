import { Injectable } from '@nestjs/common';
import { FinanceMonthly, UtilityMonthly, UtilityPayment } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * `FinanceMonthly.month` / `UtilityMonthly.month` are the string primary key
 * ("Iyul", "Avg", ...) — there's no separate ordinal column to `ORDER BY`,
 * so chronological order has to be reconstructed in application code. This
 * is the exact 12-month rolling window `prisma/seed.ts` and the web-admin
 * mock (`MONTHS` in `shared/data/mock.ts`) both use.
 */
const MONTH_ORDER = ['Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek', 'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn'];

function byMonthOrder<T extends { month: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month));
}

/**
 * Finance/utility read endpoints for the web-admin "Moliya va kommunal"
 * page — drop-in replacements for the `FINANCE_MONTHLY` / `UTILITY_PAYMENTS`
 * / `UTILITY_MONTHLY` mock exports. Every field lines up 1:1 with the
 * Prisma models (no Date columns here to serialize), so rows are returned
 * as-is.
 */
@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async monthly(): Promise<FinanceMonthly[]> {
    const rows = await this.prisma.financeMonthly.findMany();
    return byMonthOrder(rows);
  }

  utilityPayments(): Promise<UtilityPayment[]> {
    return this.prisma.utilityPayment.findMany({
      orderBy: [{ districtId: 'asc' }, { type: 'asc' }],
    });
  }

  async utilityMonthly(): Promise<UtilityMonthly[]> {
    const rows = await this.prisma.utilityMonthly.findMany();
    return byMonthOrder(rows);
  }
}
