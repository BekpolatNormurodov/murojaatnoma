import { Injectable } from '@nestjs/common';
import { BonusRequest } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePremyaDto } from './dto/create-premya.dto';

export interface PremyaRequestDto {
  id: string;
  amount: number | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

/**
 * Employee bonus (premya) requests (worker-app). Matches the shared contract:
 * POST /premya -> create, GET /premya/me -> BonusRequest[] for the caller.
 */
@Injectable()
export class PremyaService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(r: BonusRequest): PremyaRequestDto {
    return {
      id: r.id,
      amount: r.amount,
      reason: r.reason,
      status: r.status as 'pending' | 'approved' | 'rejected',
      createdAt: r.createdAt.toISOString(),
    };
  }

  async create(employeeId: string, dto: CreatePremyaDto): Promise<PremyaRequestDto> {
    const created = await this.prisma.bonusRequest.create({
      data: {
        employeeId,
        amount: dto.amount ?? null,
        reason: dto.reason,
      },
    });
    return this.toDto(created);
  }

  async findMine(employeeId: string): Promise<PremyaRequestDto[]> {
    const records = await this.prisma.bonusRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDto(r));
  }
}
