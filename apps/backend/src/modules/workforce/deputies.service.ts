import { Injectable, NotFoundException } from '@nestjs/common';
import { Deputy } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateDeputyDto } from './dto/create-deputy.dto';
import { UpdateDeputyDto } from './dto/update-deputy.dto';

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

  /**
   * `POST /deputies` — new deputy governor profile from the web-admin form.
   * Server always generates `id` (`d-` prefixed, matching the seed's
   * `d1`/`d2`/... family).
   */
  async create(dto: CreateDeputyDto): Promise<Deputy> {
    return this.prisma.deputy.create({
      data: {
        id: `d-${Date.now()}`,
        name: dto.name,
        photo: dto.photo,
        color: dto.color,
        position: dto.position,
        direction: dto.direction,
        shortDirection: dto.shortDirection,
        categories: dto.categories ?? [],
        topics: dto.topics ?? [],
        phone: dto.phone,
        email: dto.email,
        office: dto.office,
        receptionDay: dto.receptionDay,
      },
    });
  }

  /** `PATCH /deputies/:id` — partial update; only supplied fields are touched. */
  async update(id: string, dto: UpdateDeputyDto): Promise<Deputy> {
    await this.findOne(id);

    return this.prisma.deputy.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.photo !== undefined ? { photo: dto.photo } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.direction !== undefined ? { direction: dto.direction } : {}),
        ...(dto.shortDirection !== undefined ? { shortDirection: dto.shortDirection } : {}),
        ...(dto.categories !== undefined ? { categories: dto.categories } : {}),
        ...(dto.topics !== undefined ? { topics: dto.topics } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.office !== undefined ? { office: dto.office } : {}),
        ...(dto.receptionDay !== undefined ? { receptionDay: dto.receptionDay } : {}),
      },
    });
  }

  /** `DELETE /deputies/:id` — hard delete (no soft-delete field on this model). */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.deputy.delete({ where: { id } });
  }
}
