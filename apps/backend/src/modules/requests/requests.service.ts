import { Injectable, NotFoundException } from '@nestjs/common';
import { CitizenRequest, Prisma, RequestCategory, RequestStatus } from '@prisma/client';
import { Paginated } from '../../common/interfaces/paginated.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
import { UpdateRequestDto } from './dto/update-request.dto';

/**
 * `GET /requests/:id` / list-item response shape — a drop-in replacement for
 * the web-admin `CitizenRequest` mock type (same field names, dates as ISO
 * strings). `CitizenRequest` has no Prisma relations, so this is a flat
 * date-serialization mapping of the row.
 */
export type CitizenRequestResponse = Omit<CitizenRequest, 'createdAt' | 'resolvedAt'> & {
  createdAt: string;
  resolvedAt: string | null;
};

export interface RequestStatsResponse {
  total: number;
  byStatus: Record<RequestStatus, number>;
  byCategory: Record<RequestCategory, number>;
  byDistrict: { districtId: string; count: number }[];
}

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(request: CitizenRequest): CitizenRequestResponse {
    return {
      ...request,
      createdAt: request.createdAt.toISOString(),
      resolvedAt: request.resolvedAt ? request.resolvedAt.toISOString() : null,
    };
  }

  async findAll(query: ListRequestsQueryDto): Promise<Paginated<CitizenRequestResponse>> {
    const { page, limit, category, district, status, priority } = query;
    const where: Prisma.CitizenRequestWhereInput = {
      ...(category ? { category } : {}),
      ...(district ? { districtId: district } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.citizenRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.citizenRequest.count({ where }),
    ]);

    return { data: rows.map((row) => this.toResponse(row)), total, page, limit };
  }

  async findOne(id: string): Promise<CitizenRequestResponse> {
    const request = await this.prisma.citizenRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException(`Request ${id} not found`);
    }
    return this.toResponse(request);
  }

  async update(id: string, dto: UpdateRequestDto): Promise<CitizenRequestResponse> {
    await this.ensureExists(id);

    const updated = await this.prisma.citizenRequest.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.assignedWorkerId !== undefined
          ? { assignedWorkerId: dto.assignedWorkerId }
          : {}),
      },
    });

    return this.toResponse(updated);
  }

  /** Aggregate counts for the requests dashboard (totals, by status/category/district). */
  async stats(): Promise<RequestStatsResponse> {
    const [total, statusGroups, categoryGroups, districtGroups] = await Promise.all([
      this.prisma.citizenRequest.count(),
      this.prisma.citizenRequest.groupBy({ by: ['status'], _count: true }),
      this.prisma.citizenRequest.groupBy({ by: ['category'], _count: true }),
      this.prisma.citizenRequest.groupBy({ by: ['districtId'], _count: true }),
    ]);

    const byStatus: Record<RequestStatus, number> = {
      [RequestStatus.new]: 0,
      [RequestStatus.in_progress]: 0,
      [RequestStatus.resolved]: 0,
      [RequestStatus.rejected]: 0,
    };
    for (const group of statusGroups) {
      byStatus[group.status] = group._count;
    }

    const byCategory: Record<RequestCategory, number> = {
      [RequestCategory.kommunal]: 0,
      [RequestCategory.yol]: 0,
      [RequestCategory.suv]: 0,
      [RequestCategory.elektr]: 0,
      [RequestCategory.tozalik]: 0,
      [RequestCategory.obodonlashtirish]: 0,
    };
    for (const group of categoryGroups) {
      byCategory[group.category] = group._count;
    }

    const byDistrict = districtGroups
      .map((group) => ({ districtId: group.districtId, count: group._count }))
      .sort((a, b) => b.count - a.count);

    return { total, byStatus, byCategory, byDistrict };
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.citizenRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Request ${id} not found`);
    }
  }
}
