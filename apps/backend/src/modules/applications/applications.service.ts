import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Application,
  ApplicationEventType,
  ApplicationMessage,
  ApplicationStatus,
  Attachment,
  AttachmentType,
  MessageSenderRole,
  NotificationType,
  Priority,
} from '@prisma/client';
import { PushService } from '../push/push.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Paginated } from '../../common/interfaces/paginated.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AssignApplicationDto } from './dto/assign-application.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { ReplyApplicationDto } from './dto/reply-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { ApplicationEventWithNames } from './interfaces/application-event-with-names.interface';

/** Allowed forward transitions for the application lifecycle: new -> in_progress -> resolved/rejected. */
const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.NEW]: [ApplicationStatus.IN_PROGRESS, ApplicationStatus.REJECTED],
  [ApplicationStatus.IN_PROGRESS]: [
    ApplicationStatus.RESOLVED,
    ApplicationStatus.REJECTED,
  ],
  // Reopen (citizen unhappy / admin) — back to work.
  [ApplicationStatus.RESOLVED]: [ApplicationStatus.IN_PROGRESS],
  [ApplicationStatus.REJECTED]: [],
};

/** SLA: how long the hokimiyat has to resolve a murojaat, by priority. */
const SLA_HOURS: Record<Priority, number> = {
  [Priority.high]: 48,
  [Priority.medium]: 5 * 24,
  [Priority.low]: 10 * 24,
};

/** Application + the assignee's display info (list/detail screens). */
export type ApplicationWithAssignee = Application & {
  assignedEmployee: { id: string; fullName: string; avatarUrl: string | null } | null;
};

export interface ApplicationStats {
  total: number;
  byStatus: Record<ApplicationStatus, number>;
  /** Open (NEW/IN_PROGRESS) past their SLA deadline. */
  overdue: number;
  /** NEW and nobody assigned yet. */
  unassigned: number;
  /** Mean hours from creation to resolution (resolved ones). */
  avgResolutionHours: number | null;
  /** Mean citizen rating 1..5 (rated ones). */
  avgRating: number | null;
  ratedCount: number;
  /** Per assignee: open / resolved / avg rating — the leaderboard. */
  byEmployee: Array<{
    employeeId: string;
    fullName: string;
    open: number;
    resolved: number;
    avgRating: number | null;
  }>;
}

const ASSIGNEE_SELECT = {
  assignedEmployee: { select: { id: true, fullName: true, avatarUrl: true } },
} as const;

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  async create(dto: CreateApplicationDto): Promise<Application> {
    const priority = dto.priority ?? Priority.medium;
    const dueAt = new Date(Date.now() + SLA_HOURS[priority] * 3_600_000);
    return this.prisma.$transaction(async (tx) => {
      const application = await tx.application.create({
        data: { ...dto, priority, dueAt },
      });

      await tx.applicationEvent.create({
        data: {
          applicationId: application.id,
          type: ApplicationEventType.CREATED,
          toStatus: application.status,
        },
      });

      return application;
    });
  }

  async findAll(
    query: ListApplicationsQueryDto,
    user?: AuthenticatedUser,
  ): Promise<Paginated<ApplicationWithAssignee>> {
    const { page, limit, status, assignedTo } = query;
    const where = {
      ...(status ? { status } : {}),
      // `assignedTo=me` — the worker-app "Menga biriktirilgan" tab, filtered
      // server-side instead of downloading the whole inbox.
      ...(assignedTo === 'me' && user && user.role !== 'CITIZEN'
        ? { assignedEmployeeId: user.employeeId }
        : {}),
      // A CITIZEN principal (a phone with no employee record) may ONLY ever
      // see their own applications, scoped server-side by the phone in their
      // token — never the whole inbox. Staff (employee/admin) see all.
      ...(user?.role === 'CITIZEN' ? { applicantPhone: user.phone } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: ASSIGNEE_SELECT,
      }),
      this.prisma.application.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string, user?: AuthenticatedUser): Promise<Application> {
    const application = await this.prisma.application.findUnique({
      where: { id },
    });
    if (!application) {
      throw new NotFoundException(`Application ${id} not found`);
    }
    // Ownership: a CITIZEN may only read their own murojaat (matched by the
    // phone in their token). Staff and internal callers (no `user` passed)
    // are unrestricted.
    if (user?.role === 'CITIZEN' && application.applicantPhone !== user.phone) {
      throw new ForbiddenException('Bu murojaat sizga tegishli emas');
    }
    return application;
  }

  async updateStatus(
    id: string,
    dto: UpdateApplicationStatusDto,
    actorEmployeeId?: string,
  ): Promise<Application> {
    const application = await this.findOne(id);
    const allowedNextStatuses = ALLOWED_TRANSITIONS[application.status];
    const isStatusChange = dto.status !== application.status;

    if (isStatusChange && !allowedNextStatuses.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition application from ${application.status} to ${dto.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.application.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.assignedEmployeeId ? { assignedEmployeeId: dto.assignedEmployeeId } : {}),
          ...(isStatusChange && dto.status === ApplicationStatus.RESOLVED
            ? { resolvedAt: new Date() }
            : {}),
          ...(isStatusChange && dto.status === ApplicationStatus.IN_PROGRESS
            ? { resolvedAt: null }
            : {}),
        },
      });

      if (isStatusChange) {
        await tx.applicationEvent.create({
          data: {
            applicationId: id,
            type: ApplicationEventType.STATUS_CHANGED,
            fromStatus: application.status,
            toStatus: dto.status,
            actorEmployeeId,
          },
        });
      }

      return updated;
    });
  }

  /**
   * Post on the murojaat thread. The sender ROLE comes from the token, not
   * the body (it used to be client-supplied on a public route — anyone could
   * post "as the employee" on any murojaat). A citizen may only post on their
   * own; the assignee is notified of a citizen's message.
   */
  async addMessage(
    applicationId: string,
    dto: CreateMessageDto,
    user?: AuthenticatedUser,
  ): Promise<ApplicationMessage> {
    const application = await this.findOne(applicationId, user);
    const isCitizen = !user || user.role === 'CITIZEN';
    const message = await this.prisma.applicationMessage.create({
      data: {
        applicationId,
        senderRole: isCitizen ? MessageSenderRole.CITIZEN : MessageSenderRole.EMPLOYEE,
        senderName: dto.senderName,
        text: dto.text,
        attachmentUrl: dto.attachmentUrl,
      },
    });
    if (isCitizen && application.assignedEmployeeId) {
      void this.notify(
        application.assignedEmployeeId,
        'Fuqarodan yangi xabar',
        `"${titleOf(application.subject)}": ${dto.text.slice(0, 120)}`,
        application.id,
      );
    }
    return message;
  }

  async findMessages(
    applicationId: string,
    user?: AuthenticatedUser,
  ): Promise<ApplicationMessage[]> {
    await this.findOne(applicationId, user);
    return this.prisma.applicationMessage.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addAttachment(
    applicationId: string,
    dto: CreateAttachmentDto,
    user?: AuthenticatedUser,
  ): Promise<Attachment> {
    await this.findOne(applicationId, user);
    return this.prisma.attachment.create({
      data: { applicationId, ...dto },
    });
  }

  async findAttachments(
    applicationId: string,
    user?: AuthenticatedUser,
  ): Promise<Attachment[]> {
    await this.findOne(applicationId, user);
    return this.prisma.attachment.findMany({
      where: { applicationId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  /**
   * Persists an Attachment row for a file that was actually uploaded via
   * POST /applications/:id/attachments/upload (multipart), as opposed to
   * {@link addAttachment} which records a pre-hosted URL supplied by the
   * caller. Verifies the application exists, same as addAttachment.
   */
  async createUploadedAttachment(
    applicationId: string,
    data: {
      type: AttachmentType;
      url: string;
      fileName?: string;
      mimeType?: string;
      sizeBytes?: number;
    },
    user?: AuthenticatedUser,
  ): Promise<Attachment> {
    await this.findOne(applicationId, user);
    return this.prisma.attachment.create({
      data: { applicationId, ...data },
    });
  }

  /**
   * Routes ("aylantirish") an application to an employee and/or a
   * department, records an ASSIGNED audit event, and notifies the newly
   * assigned employee (if any).
   */
  async assign(
    applicationId: string,
    dto: AssignApplicationDto,
    actorEmployeeId: string,
  ): Promise<Application> {
    if (!dto.assignedEmployeeId && !dto.assignedDepartmentId) {
      throw new BadRequestException(
        'At least one of assignedEmployeeId or assignedDepartmentId is required',
      );
    }

    const application = await this.findOne(applicationId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.application.update({
        where: { id: applicationId },
        data: {
          ...(dto.assignedEmployeeId !== undefined
            ? { assignedEmployeeId: dto.assignedEmployeeId }
            : {}),
          ...(dto.assignedDepartmentId !== undefined
            ? { assignedDepartmentId: dto.assignedDepartmentId }
            : {}),
        },
      });

      await tx.applicationEvent.create({
        data: {
          applicationId,
          type: ApplicationEventType.ASSIGNED,
          fromEmployeeId: application.assignedEmployeeId,
          toEmployeeId: dto.assignedEmployeeId,
          departmentId: dto.assignedDepartmentId,
          actorEmployeeId,
          note: dto.note,
        },
      });

      // Assigning a brand-new murojaat puts it to work (NEW -> IN_PROGRESS).
      if (dto.assignedEmployeeId && application.status === ApplicationStatus.NEW) {
        await tx.application.update({
          where: { id: applicationId },
          data: { status: ApplicationStatus.IN_PROGRESS },
        });
        await tx.applicationEvent.create({
          data: {
            applicationId,
            type: ApplicationEventType.STATUS_CHANGED,
            fromStatus: ApplicationStatus.NEW,
            toStatus: ApplicationStatus.IN_PROGRESS,
            actorEmployeeId,
            note: 'Xodimga biriktirildi',
          },
        });
        updated.status = ApplicationStatus.IN_PROGRESS;
      }

      if (dto.assignedEmployeeId) {
        await tx.notification.create({
          data: {
            employeeId: dto.assignedEmployeeId,
            title: 'Yangi murojaat biriktirildi',
            body: `"${titleOf(application.subject)}" murojaati sizga biriktirildi.`,
            type: NotificationType.APPLICATION,
          },
        });
      }

      return updated;
    }).then((updated) => {
      // Push AFTER commit — the phone rings even when the app is closed.
      if (dto.assignedEmployeeId) {
        void this.push
          .sendToEmployee(
            dto.assignedEmployeeId,
            'Yangi murojaat biriktirildi',
            titleOf(application.subject),
            { type: 'application', applicationId },
          )
          .catch(() => undefined);
      }
      return updated;
    });
  }

  /** Ordered audit history for an application, with actor/target names resolved. */
  async findEvents(applicationId: string): Promise<ApplicationEventWithNames[]> {
    await this.findOne(applicationId);

    const events = await this.prisma.applicationEvent.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'asc' },
    });

    const employeeIds = new Set<string>();
    const departmentIds = new Set<string>();
    for (const event of events) {
      if (event.actorEmployeeId) employeeIds.add(event.actorEmployeeId);
      if (event.fromEmployeeId) employeeIds.add(event.fromEmployeeId);
      if (event.toEmployeeId) employeeIds.add(event.toEmployeeId);
      if (event.departmentId) departmentIds.add(event.departmentId);
    }

    const [employees, departments] = await Promise.all([
      employeeIds.size
        ? this.prisma.employee.findMany({
            where: { id: { in: [...employeeIds] } },
            select: { id: true, fullName: true },
          })
        : Promise.resolve([]),
      departmentIds.size
        ? this.prisma.department.findMany({
            where: { id: { in: [...departmentIds] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const employeeNameById = new Map(employees.map((employee) => [employee.id, employee.fullName]));
    const departmentNameById = new Map(departments.map((department) => [department.id, department.name]));

    return events.map((event) => ({
      ...event,
      actorName: event.actorEmployeeId
        ? (employeeNameById.get(event.actorEmployeeId) ?? null)
        : null,
      fromEmployeeName: event.fromEmployeeId
        ? (employeeNameById.get(event.fromEmployeeId) ?? null)
        : null,
      toEmployeeName: event.toEmployeeId
        ? (employeeNameById.get(event.toEmployeeId) ?? null)
        : null,
      departmentName: event.departmentId
        ? (departmentNameById.get(event.departmentId) ?? null)
        : null,
    }));
  }

  /**
   * Staff (employee/admin) reply on an application's chat thread. Records a
   * MESSAGE audit event and, on the first staff reply to a brand-new
   * application, auto-advances the status NEW -> IN_PROGRESS (also recording
   * a STATUS_CHANGED event for that transition).
   */
  async reply(
    applicationId: string,
    dto: ReplyApplicationDto,
    actor: AuthenticatedUser,
  ): Promise<ApplicationMessage> {
    const application = await this.findOne(applicationId);

    const employee = await this.prisma.employee.findUnique({
      where: { id: actor.employeeId },
      select: { fullName: true },
    });
    const senderName = employee?.fullName ?? actor.username ?? null;
    const shouldAutoAdvance = application.status === ApplicationStatus.NEW;
    // `resolve: true` — the assignee's final answer (with proof): closes the
    // murojaat as RESOLVED and stamps resolvedAt in the same transaction.
    const shouldResolve =
      dto.resolve === true &&
      (application.status === ApplicationStatus.NEW ||
        application.status === ApplicationStatus.IN_PROGRESS);

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.applicationMessage.create({
        data: {
          applicationId,
          senderRole: MessageSenderRole.EMPLOYEE,
          senderName,
          text: dto.text,
          attachmentUrl: dto.attachmentUrl,
        },
      });

      await tx.applicationEvent.create({
        data: {
          applicationId,
          type: ApplicationEventType.MESSAGE,
          actorEmployeeId: actor.employeeId,
        },
      });

      if (shouldAutoAdvance) {
        await tx.application.update({
          where: { id: applicationId },
          data: { status: ApplicationStatus.IN_PROGRESS },
        });

        await tx.applicationEvent.create({
          data: {
            applicationId,
            type: ApplicationEventType.STATUS_CHANGED,
            fromStatus: ApplicationStatus.NEW,
            toStatus: ApplicationStatus.IN_PROGRESS,
            actorEmployeeId: actor.employeeId,
            note: 'Auto-advanced on first staff reply',
          },
        });
      }

      if (shouldResolve) {
        await tx.application.update({
          where: { id: applicationId },
          data: { status: ApplicationStatus.RESOLVED, resolvedAt: new Date() },
        });
        await tx.applicationEvent.create({
          data: {
            applicationId,
            type: ApplicationEventType.STATUS_CHANGED,
            fromStatus: ApplicationStatus.IN_PROGRESS,
            toStatus: ApplicationStatus.RESOLVED,
            actorEmployeeId: actor.employeeId,
            note: 'Javob berildi',
          },
        });
      }

      return message;
    });
  }

  /**
   * Citizen feedback (1..5) on their RESOLVED murojaat. Rating can be updated
   * (last one wins). The assignee gets the rating as a notification.
   */
  async rate(
    applicationId: string,
    user: AuthenticatedUser,
    rating: number,
    comment?: string,
  ): Promise<Application> {
    const application = await this.findOne(applicationId, user);
    if (user.role !== 'CITIZEN') {
      throw new ForbiddenException('Faqat murojaat egasi baholaydi');
    }
    if (application.status !== ApplicationStatus.RESOLVED) {
      throw new BadRequestException("Faqat hal qilingan murojaatni baholash mumkin");
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.application.update({
        where: { id: applicationId },
        data: { rating, ratingComment: comment?.trim() || null },
      });
      await tx.applicationEvent.create({
        data: {
          applicationId,
          type: ApplicationEventType.RATED,
          note: `${rating}/5${comment ? ` — ${comment.trim().slice(0, 200)}` : ''}`,
        },
      });
      return row;
    });
    if (application.assignedEmployeeId) {
      void this.notify(
        application.assignedEmployeeId,
        `Fuqaro baholadi: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`,
        `"${titleOf(application.subject)}"${comment ? ` — ${comment.slice(0, 100)}` : ''}`,
        applicationId,
      );
    }
    return updated;
  }

  /**
   * Citizen is not satisfied: RESOLVED -> IN_PROGRESS with their reason posted
   * on the thread; the assignee is notified to continue.
   */
  async reopen(
    applicationId: string,
    user: AuthenticatedUser,
    reason: string,
  ): Promise<Application> {
    const application = await this.findOne(applicationId, user);
    if (user.role !== 'CITIZEN') {
      throw new ForbiddenException("Faqat murojaat egasi qayta ochishi mumkin");
    }
    if (application.status !== ApplicationStatus.RESOLVED) {
      throw new BadRequestException("Faqat hal qilingan murojaat qayta ochiladi");
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.application.update({
        where: { id: applicationId },
        data: { status: ApplicationStatus.IN_PROGRESS, resolvedAt: null, rating: null },
      });
      await tx.applicationMessage.create({
        data: {
          applicationId,
          senderRole: MessageSenderRole.CITIZEN,
          senderName: application.applicantFullName,
          text: `Muammo hal bo'lmadi: ${reason.trim()}`,
        },
      });
      await tx.applicationEvent.create({
        data: {
          applicationId,
          type: ApplicationEventType.REOPENED,
          fromStatus: ApplicationStatus.RESOLVED,
          toStatus: ApplicationStatus.IN_PROGRESS,
          note: reason.trim().slice(0, 300),
        },
      });
      return row;
    });
    if (application.assignedEmployeeId) {
      void this.notify(
        application.assignedEmployeeId,
        'Murojaat qayta ochildi',
        `"${titleOf(application.subject)}": ${reason.trim().slice(0, 120)}`,
        applicationId,
      );
    }
    return updated;
  }

  /** Dashboard / leaderboard numbers for the whole murojaat pipeline. */
  async stats(): Promise<ApplicationStats> {
    const now = new Date();
    const [grouped, overdue, unassigned, resolvedRows, ratingAgg, perEmployee] =
      await Promise.all([
        this.prisma.application.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.application.count({
          where: {
            status: { in: [ApplicationStatus.NEW, ApplicationStatus.IN_PROGRESS] },
            dueAt: { lt: now },
          },
        }),
        this.prisma.application.count({
          where: { status: ApplicationStatus.NEW, assignedEmployeeId: null },
        }),
        this.prisma.application.findMany({
          where: { status: ApplicationStatus.RESOLVED, resolvedAt: { not: null } },
          select: { createdAt: true, resolvedAt: true },
          take: 2000,
          orderBy: { resolvedAt: 'desc' },
        }),
        this.prisma.application.aggregate({
          where: { rating: { not: null } },
          _avg: { rating: true },
          _count: { rating: true },
        }),
        this.prisma.application.groupBy({
          by: ['assignedEmployeeId', 'status'],
          where: { assignedEmployeeId: { not: null } },
          _count: { _all: true },
          _avg: { rating: true },
        }),
      ]);

    const byStatus = {
      [ApplicationStatus.NEW]: 0,
      [ApplicationStatus.IN_PROGRESS]: 0,
      [ApplicationStatus.RESOLVED]: 0,
      [ApplicationStatus.REJECTED]: 0,
    } as Record<ApplicationStatus, number>;
    for (const g of grouped) byStatus[g.status] = g._count._all;

    const hours = resolvedRows
      .filter((r) => r.resolvedAt)
      .map((r) => (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3_600_000);
    const avgResolutionHours = hours.length
      ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10
      : null;

    const byEmp = new Map<string, { open: number; resolved: number; ratingSum: number; ratingN: number }>();
    for (const g of perEmployee) {
      const id = g.assignedEmployeeId!;
      const e = byEmp.get(id) ?? { open: 0, resolved: 0, ratingSum: 0, ratingN: 0 };
      if (g.status === ApplicationStatus.RESOLVED) {
        e.resolved += g._count._all;
        if (g._avg.rating != null) {
          e.ratingSum += g._avg.rating * g._count._all;
          e.ratingN += g._count._all;
        }
      } else if (g.status === ApplicationStatus.NEW || g.status === ApplicationStatus.IN_PROGRESS) {
        e.open += g._count._all;
      }
      byEmp.set(id, e);
    }
    const names = byEmp.size
      ? await this.prisma.employee.findMany({
          where: { id: { in: [...byEmp.keys()] } },
          select: { id: true, fullName: true },
        })
      : [];
    const nameById = new Map(names.map((n) => [n.id, n.fullName]));

    return {
      total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      byStatus,
      overdue,
      unassigned,
      avgResolutionHours,
      avgRating: ratingAgg._avg.rating != null ? Math.round(ratingAgg._avg.rating * 10) / 10 : null,
      ratedCount: ratingAgg._count.rating,
      byEmployee: [...byEmp.entries()]
        .map(([employeeId, e]) => ({
          employeeId,
          fullName: nameById.get(employeeId) ?? 'Xodim',
          open: e.open,
          resolved: e.resolved,
          avgRating: e.ratingN ? Math.round((e.ratingSum / e.ratingN) * 10) / 10 : null,
        }))
        .sort((a, b) => b.resolved - a.resolved || a.open - b.open),
    };
  }

  /** In-app notification + push, never throwing. */
  private async notify(
    employeeId: string,
    title: string,
    body: string,
    applicationId: string,
  ): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: { employeeId, title, body, type: NotificationType.APPLICATION },
      });
      await this.push.sendToEmployee(employeeId, title, body, {
        type: 'application',
        applicationId,
      });
    } catch {
      // best-effort
    }
  }
}

/** "[ARIZA|Kommunal] Ko'cha chirog'i" -> "Ko'cha chirog'i" (user-app encodes kind+category). */
export function titleOf(subject: string): string {
  const m = /^\[(?:ARIZA|SHIKOYAT)\|[^\]]*\]\s*(.*)$/s.exec(subject);
  return (m ? m[1] : subject).trim();
}

/** Category text from the encoded subject ('' if none). */
export function categoryOf(subject: string): string {
  const m = /^\[(?:ARIZA|SHIKOYAT)\|([^\]]*)\]/.exec(subject);
  return m ? m[1].trim() : '';
}
