import { Injectable, NotFoundException } from '@nestjs/common';
import { CitizenRequest, Prisma, RequestCategory, RequestStatus } from '@prisma/client';
import { Paginated } from '../../common/interfaces/paginated.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';
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

  /**
   * `POST /requests` — new murojaat submitted from the web-admin form. The
   * server always generates `id` (seed uses `R-${1000 + i}`; live rows use a
   * timestamp-based id in the same `R-` family so both stay collision-free
   * and sortable) and `createdAt`, even if the caller's payload includes
   * them (the store's `add()` action sends `Omit<CitizenRequest, "id">`,
   * which does carry a `createdAt`).
   */
  async create(dto: CreateRequestDto): Promise<CitizenRequestResponse> {
    const created = await this.prisma.citizenRequest.create({
      data: {
        id: `R-${Date.now()}`,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        status: dto.status ?? RequestStatus.new,
        region: dto.region,
        districtId: dto.districtId,
        address: dto.address,
        citizenName: dto.citizenName,
        citizenPhone: dto.citizenPhone,
        citizenPhoto: dto.citizenPhoto ?? '',
        createdAt: new Date(),
        // A freshly submitted request can't already be resolved.
        resolvedAt: null,
        assignedWorkerId: dto.assignedWorkerId ?? null,
        priority: dto.priority,
        lat: dto.lat ?? 0,
        lng: dto.lng ?? 0,
        photos: dto.photos ?? [],
        responseHours: dto.responseHours ?? null,
        feedback: dto.feedback ?? null,
        cost: dto.cost ?? 0,
      },
    });

    return this.toResponse(created);
  }

  /**
   * `PATCH /requests/:id` — status transition and/or (re)assignment.
   * `resolvedAt` is derived server-side (mirrors the web-admin store's
   * optimistic-update logic): it's stamped the moment `status` becomes
   * `resolved` (keeping any prior value if it was already resolved), and
   * cleared whenever the status moves to anything else.
   */
  async update(id: string, dto: UpdateRequestDto): Promise<CitizenRequestResponse> {
    const existing = await this.prisma.citizenRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Request ${id} not found`);
    }

    const nextStatus = dto.status ?? existing.status;
    const resolved = nextStatus === RequestStatus.resolved;

    const updated = await this.prisma.citizenRequest.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.assignedWorkerId !== undefined
          ? { assignedWorkerId: dto.assignedWorkerId }
          : {}),
        ...(dto.status
          ? { resolvedAt: resolved ? (existing.resolvedAt ?? new Date()) : null }
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
}
