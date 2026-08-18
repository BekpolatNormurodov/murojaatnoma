import { Injectable, NotFoundException } from '@nestjs/common';
import { Bonus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBonusDto } from './dto/create-bonus.dto';
import { ListBonusesQueryDto } from './dto/list-bonuses-query.dto';
import { UpdateBonusDto } from './dto/update-bonus.dto';

/**
 * `Bonus` row response shape — flat date-serialization mapping, no Prisma
 * relations on this model (see `prisma/schema.prisma`).
 */
export type BonusResponse = Omit<Bonus, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

/**
 * Employee bonuses (premya) — admin grants a bonus to an employee/worker;
 * the recipient can see their own history in worker-app.
 */
@Injectable()
export class BonusesService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(bonus: Bonus): BonusResponse {
    return {
      ...bonus,
      createdAt: bonus.createdAt.toISOString(),
      updatedAt: bonus.updatedAt.toISOString(),
    };
  }

  async create(dto: CreateBonusDto): Promise<BonusResponse> {
    const created = await this.prisma.bonus.create({
      data: {
        recipientName: dto.recipientName,
        amount: dto.amount,
        reason: dto.reason,
        month: dto.month,
        employeeId: dto.employeeId,
        workerId: dto.workerId,
      },
    });
    return this.toResponse(created);
  }

  async findAll(query: ListBonusesQueryDto): Promise<BonusResponse[]> {
    const records = await this.prisma.bonus.findMany({
      where: query.month ? { month: query.month } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toResponse(r));
  }

  /**
   * Partial update — only the fields present in {@link UpdateBonusDto} are
   * written. `employeeId`/`workerId` are updated when sent (incl. `null` to
   * clear), so switching a bonus between worker/staff/free-text is supported.
   */
  async update(id: string, dto: UpdateBonusDto): Promise<BonusResponse> {
    const existing = await this.prisma.bonus.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Bonus ${id} not found`);
    }
    const updated = await this.prisma.bonus.update({
      where: { id },
      data: {
        ...(dto.recipientName !== undefined ? { recipientName: dto.recipientName } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
        ...(dto.month !== undefined ? { month: dto.month } : {}),
        ...(dto.employeeId !== undefined ? { employeeId: dto.employeeId } : {}),
        ...(dto.workerId !== undefined ? { workerId: dto.workerId } : {}),
      },
    });
    return this.toResponse(updated);
  }

  async findByEmployee(employeeId: string): Promise<BonusResponse[]> {
    const records = await this.prisma.bonus.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toResponse(r));
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.bonus.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Bonus ${id} not found`);
    }
    await this.prisma.bonus.delete({ where: { id } });
  }
}
