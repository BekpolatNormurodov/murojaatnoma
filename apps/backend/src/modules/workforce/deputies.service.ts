import { Injectable, NotFoundException } from '@nestjs/common';
import { Deputy } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Hokim o'rinbosarlari (deputy governors) — profile list only.
 * Maps 1:1 onto the web-admin mock's `Deputy` shape. Small, static-ish list
 * (6 seeded rows) so no filters/pagination are offered — matches the mock's
 * plain `DEPUTIES: Deputy[]` export.
 */
@Injectable()
export class DeputiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Deputy[]> {
    return this.prisma.deputy.findMany({ orderBy: { id: 'asc' } });
  }

  async findOne(id: string): Promise<Deputy> {
    const deputy = await this.prisma.deputy.findUnique({ where: { id } });
    if (!deputy) {
      throw new NotFoundException(`Deputy ${id} not found`);
    }
    return deputy;
  }
}
