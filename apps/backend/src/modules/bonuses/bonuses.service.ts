import { Injectable, NotFoundException } from '@nestjs/common';
import { Bonus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBonusDto } from './dto/create-bonus.dto';
import { ListBonusesQueryDto } from './dto/list-bonuses-query.dto';

/**
 * `Bonus` row response shape — flat date-serialization mapping, no Prisma
 * relations on this model (see `prisma/schema.prisma`).
 */
export type BonusResponse = Omit<Bonus, 'createdAt'> & { createdAt: string };

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
