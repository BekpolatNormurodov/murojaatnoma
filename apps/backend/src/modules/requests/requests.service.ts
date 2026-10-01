import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Application,
  ApplicationEventType,
  ApplicationStatus,
  AttachmentType,
  CitizenRequest,
  Prisma,
  RequestCategory,
  RequestStatus,
} from '@prisma/client';
import { ApplicationsService, categoryOf, titleOf } from '../applications/applications.service';
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
  /** 'citizen' = real murojaat from the citizen app (Application); 'legacy' = old CitizenRequest row. */
  source?: 'citizen' | 'legacy';
  /** ARIZA | SHIKOYAT (citizen app). */
  kind?: 'ariza' | 'shikoyat';
  /** SLA missed and admins were alerted. */
  escalated?: boolean;
  /** Times the citizen reopened it. */
  reopenCount?: number;
  /** SLA deadline (ISO) — citizen murojaats only. */
  dueAt?: string | null;
  /** Assigned employee's display info (real Employee). */
  assignedEmployee?: { id: string; fullName: string; avatarUrl: string | null } | null;
  ratingComment?: string | null;
  /** False when the citizen sent no location (lat/lng are a district placeholder). */
  hasCoords?: boolean;
};

const STATUS_TO_REQUEST: Record<ApplicationStatus, RequestStatus> = {
  [ApplicationStatus.NEW]: RequestStatus.new,
  [ApplicationStatus.IN_PROGRESS]: RequestStatus.in_progress,
  [ApplicationStatus.RESOLVED]: RequestStatus.resolved,
  [ApplicationStatus.REJECTED]: RequestStatus.rejected,
};
const STATUS_TO_APPLICATION: Record<RequestStatus, ApplicationStatus> = {
  [RequestStatus.new]: ApplicationStatus.NEW,
  [RequestStatus.in_progress]: ApplicationStatus.IN_PROGRESS,
  [RequestStatus.resolved]: ApplicationStatus.RESOLVED,
  [RequestStatus.rejected]: ApplicationStatus.REJECTED,
};

/** Free-text citizen category -> the admin's 6 fixed categories (keyword match). */
export function mapCategory(text: string): RequestCategory {
  const t = text.toLowerCase();
  if (/yo['ʻ‘’]?l|asfalt|chuqur|svetofor|trotuar/.test(t)) return RequestCategory.yol;
  if (/suv|kanaliz|quvur/.test(t)) return RequestCategory.suv;
  if (/elektr|chiroq|yorit|svet|tok\b/.test(t)) return RequestCategory.elektr;
  if (/chiqindi|axlat|tozal|sanitar/.test(t)) return RequestCategory.tozalik;
  if (/obodon|park|daraxt|bog['ʻ‘’]?|o['ʻ‘’]?yin|maydon/.test(t)) return RequestCategory.obodonlashtirish;
  return RequestCategory.kommunal;
}

/** Real murojaats are uuid ids; legacy CitizenRequest rows are 'R-…'. */
function isLegacyId(id: string): boolean {
  return id.startsWith('R-');
}

type ApplicationRow = Application & {
  assignedEmployee?: { id: string; fullName: string; avatarUrl: string | null } | null;
  attachments?: { url: string; type: AttachmentType }[];
};

export interface RequestStatsResponse {
  total: number;
  byStatus: Record<RequestStatus, number>;
  byCategory: Record<RequestCategory, number>;
  byDistrict: { districtId: string; count: number }[];
}

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ApplicationsService,
  ) {}

  /** Application -> the admin's CitizenRequest shape (so the existing UI works unchanged). */
  private fromApplication(a: ApplicationRow): CitizenRequestResponse {
    const subjectCategory = categoryOf(a.subject);
    return {
      id: a.id,
      title: titleOf(a.subject),
      description: a.description,
      category: mapCategory(`${subjectCategory} ${a.subject} ${a.description}`),
      status: STATUS_TO_REQUEST[a.status],
      region: a.region ?? 'Toshkent shahri',
      districtId: 'mirzo',
      address: a.address ?? a.district ?? '',
      citizenName: a.applicantFullName,
      citizenPhone: a.applicantPhone,
      // Selfie the citizen took when filing ("who wrote this"), if any.
      citizenPhoto: a.applicantPhotoUrl ?? '',
      createdAt: a.createdAt.toISOString(),
      resolvedAt: a.resolvedAt ? a.resolvedAt.toISOString() : null,
      assignedWorkerId: a.assignedEmployeeId,
      priority: a.priority,
      lat: a.lat ?? 41.33,
      lng: a.lng ?? 69.348,
      photos: (a.attachments ?? []).filter((x) => x.type === AttachmentType.PHOTO).map((x) => x.url),
      responseHours: a.resolvedAt
        ? Math.max(0, Math.round((a.resolvedAt.getTime() - a.createdAt.getTime()) / 3_600_000))
        : null,
      feedback: a.rating,
      cost: 0,
      source: 'citizen',
      kind: a.kind === 'SHIKOYAT' ? 'shikoyat' : 'ariza',
      dueAt: a.dueAt ? a.dueAt.toISOString() : null,
      assignedEmployee: a.assignedEmployee ?? null,
      ratingComment: a.ratingComment,
      hasCoords: a.lat != null && a.lng != null,
      escalated: a.escalatedAt != null,
      reopenCount: a.reopenCount,
    };
  }

  private async findApplication(id: string): Promise<ApplicationRow | null> {
    return this.prisma.application.findUnique({
      where: { id },
      include: {
        assignedEmployee: { select: { id: true, fullName: true, avatarUrl: true } },
        attachments: { select: { url: true, type: true } },
      },
    });
  }

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

    // Real citizen murojaats (Application) first-class, merged with the legacy
    // CitizenRequest rows, newest first. Ilgari bu ro'yxat FAQAT eski jadvalni
    // ko'rsatardi — fuqaro ilovasidan kelgan murojaat admin'ga ko'rinmasdi va
    // admin biriktirgan xodim ishchi ilovasida murojaatni ko'rmasdi.
    const appWhere: Prisma.ApplicationWhereInput = {
      ...(status ? { status: STATUS_TO_APPLICATION[status] } : {}),
      ...(priority ? { priority } : {}),
    };
    const window = page * limit;
    const [rows, legacyTotal, apps] = await Promise.all([
      this.prisma.citizenRequest.findMany({
        where,
        take: window,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.citizenRequest.count({ where }),
      district && district !== 'mirzo'
        ? Promise.resolve([] as ApplicationRow[])
        : this.prisma.application.findMany({
            where: appWhere,
            orderBy: { createdAt: 'desc' },
            take: 1000,
            include: {
              assignedEmployee: { select: { id: true, fullName: true, avatarUrl: true } },
              attachments: { select: { url: true, type: true } },
            },
          }),
    ]);
    const mappedApps = apps
      .map((a) => this.fromApplication(a))
      .filter((r) => !category || r.category === category);
    const merged = [...mappedApps, ...rows.map((row) => ({ ...this.toResponse(row), source: 'legacy' as const }))]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      data: merged.slice((page - 1) * limit, page * limit),
      total: legacyTotal + mappedApps.length,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<CitizenRequestResponse> {
    if (!isLegacyId(id)) {
      const app = await this.findApplication(id);
      if (app) return this.fromApplication(app);
    }
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
  async update(
    id: string,
    dto: UpdateRequestDto,
    actorId?: string,
  ): Promise<CitizenRequestResponse> {
    if (!isLegacyId(id)) {
      const app = await this.findApplication(id);
      if (app) return this.updateApplication(app, dto, actorId ?? 'admin');
    }
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

  /**
   * Admin action on a REAL murojaat — goes through ApplicationsService so the
   * audit trail, SLA fields, in-app notification and PUSH to the employee all
   * happen exactly as in the employee/citizen flows.
   */
  private async updateApplication(
    app: ApplicationRow,
    dto: UpdateRequestDto,
    actorId: string,
  ): Promise<CitizenRequestResponse> {
    if (dto.assignedWorkerId) {
      if (dto.assignedWorkerId !== app.assignedEmployeeId) {
        await this.applications.assign(app.id, { assignedEmployeeId: dto.assignedWorkerId }, actorId);
      }
    } else if (dto.assignedWorkerId === null && app.assignedEmployeeId) {
      await this.prisma.$transaction([
        this.prisma.application.update({ where: { id: app.id }, data: { assignedEmployeeId: null } }),
        this.prisma.applicationEvent.create({
          data: {
            applicationId: app.id,
            type: ApplicationEventType.ASSIGNED,
            fromEmployeeId: app.assignedEmployeeId,
            actorEmployeeId: actorId,
            note: 'Biriktirish bekor qilindi',
          },
        }),
      ]);
    }

    if (dto.status) {
      const target = STATUS_TO_APPLICATION[dto.status];
      const current = (await this.prisma.application.findUnique({
        where: { id: app.id },
        select: { status: true },
      }))!.status;
      if (target !== current) {
        await this.applications.updateStatus(app.id, { status: target, note: dto.note }, actorId);
      }
    }

    const fresh = await this.findApplication(app.id);
    return this.fromApplication(fresh!);
  }

  /** `DELETE /requests/:id` — hard delete (no soft-delete field on this model). */
  async remove(id: string): Promise<void> {
    if (!isLegacyId(id)) {
      const app = await this.prisma.application.findUnique({ where: { id }, select: { id: true } });
      if (app) {
        await this.prisma.application.delete({ where: { id } });
        return;
      }
    }
    const existing = await this.prisma.citizenRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Request ${id} not found`);
    }
    await this.prisma.citizenRequest.delete({ where: { id } });
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

    // Real citizen murojaats count too.
    const apps = await this.prisma.application.findMany({
      select: { status: true, subject: true, description: true },
    });
    for (const a of apps) {
      byStatus[STATUS_TO_REQUEST[a.status]] += 1;
      byCategory[mapCategory(`${categoryOf(a.subject)} ${a.subject} ${a.description}`)] += 1;
    }
    const districtCounts = new Map(districtGroups.map((g) => [g.districtId, g._count]));
    if (apps.length) districtCounts.set('mirzo', (districtCounts.get('mirzo') ?? 0) + apps.length);
    const byDistrict = [...districtCounts.entries()]
      .map(([districtId, count]) => ({ districtId, count }))
      .sort((a, b) => b.count - a.count);

    return { total: total + apps.length, byStatus, byCategory, byDistrict };
  }
}
