import { Injectable, NotFoundException } from '@nestjs/common';
import { PointsEntry } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

interface PointsEntryDto {
  id: string;
  reason: string;
  delta: number;
  at: string;
  positive: boolean;
}

interface WorkerPointsDto {
  total: number;
  rank: number | null;
  history: PointsEntryDto[];
}

/**
 * Employee points / rating (ball nazorati). Matches the worker-app contract:
 * GET /points/me -> { total, rank, history[] }, GET /points/me/history -> [].
 */
@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(e: PointsEntry): PointsEntryDto {
    return {
      id: e.id,
      reason: e.reason,
      delta: e.delta,
      at: e.createdAt.toISOString(),
      positive: e.positive,
    };
  }

  async getMe(employeeId: string): Promise<WorkerPointsDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const [entries, totals] = await Promise.all([
      this.prisma.pointsEntry.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.pointsEntry.groupBy({
        by: ['employeeId'],
        _sum: { delta: true },
      }),
    ]);

    const myTotal = totals.find((t) => t.employeeId === employeeId)?._sum.delta ?? 0;
    const rank = 1 + totals.filter((t) => (t._sum.delta ?? 0) > myTotal).length;

    return {
      total: myTotal,
      rank,
      history: entries.map((e) => this.toDto(e)),
    };
  }

  async getHistory(employeeId: string): Promise<PointsEntryDto[]> {
    const entries = await this.prisma.pointsEntry.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return entries.map((e) => this.toDto(e));
  }
}
