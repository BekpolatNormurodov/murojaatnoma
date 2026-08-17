import { Injectable } from '@nestjs/common';
import { LeaveRequest } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLeaveDto } from './dto/create-leave.dto';

export interface LeaveRequestDto {
  id: string;
  type: 'hours' | 'days';
  amount: number;
  startDate: string;
  startTime: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

/**
 * Employee leave requests (worker-app). Matches the shared contract:
 * POST /leave -> create, GET /leave/me -> LeaveRequest[] for the caller.
 */
@Injectable()
export class LeaveService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(r: LeaveRequest): LeaveRequestDto {
    return {
      id: r.id,
      type: r.type as 'hours' | 'days',
      amount: r.amount,
      startDate: r.startDate.toISOString(),
      startTime: r.startTime,
      reason: r.reason,
      status: r.status as 'pending' | 'approved' | 'rejected',
      createdAt: r.createdAt.toISOString(),
    };
  }

  async create(employeeId: string, dto: CreateLeaveDto): Promise<LeaveRequestDto> {
    const created = await this.prisma.leaveRequest.create({
      data: {
        employeeId,
        type: dto.type,
        amount: dto.amount,
        startDate: new Date(dto.startDate),
        startTime: dto.type === 'hours' ? (dto.startTime ?? null) : null,
        reason: dto.reason,
      },
    });
    return this.toDto(created);
  }

  async findMine(employeeId: string): Promise<LeaveRequestDto[]> {
    const records = await this.prisma.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDto(r));
  }
}
