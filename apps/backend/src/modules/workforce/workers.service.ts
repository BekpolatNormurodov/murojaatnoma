import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Worker } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ListWorkersQueryDto } from './dto/list-workers-query.dto';

/**
 * Dala ishchilari (field workers) — profile list + detail only.
 * Attendance/check-in business logic lives in another module; the
 * `attendance`/`documents` JSON columns below are relayed as-is because
 * they are part of the `Worker` row itself (mirrors the mock `Worker` type).
 */
@Injectable()
export class WorkersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListWorkersQueryDto): Promise<Worker[]> {
    const { districtId, status, specialization, search } = query;

    const where: Prisma.WorkerWhereInput = {
      ...(districtId ? { districtId } : {}),
      ...(status ? { status } : {}),
      ...(specialization ? { specialization: { has: specialization } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { position: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.worker.findMany({ where, orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: string): Promise<Worker> {
    const worker = await this.prisma.worker.findUnique({ where: { id } });
    if (!worker) {
      throw new NotFoundException(`Worker ${id} not found`);
    }
    return worker;
  }
}
