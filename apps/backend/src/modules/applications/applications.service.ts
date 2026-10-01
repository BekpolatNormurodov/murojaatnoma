import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AdminNotificationType,
  Application,
  ApplicationEventType,
  ApplicationKind,
  ApplicationMessage,
  ApplicationStatus,
  Attachment,
  AttachmentType,
  MessageSenderRole,
  NotificationType,
  Priority,
} from '@prisma/client';
import { NotificationCenter } from '../notifications/notification-center.service';
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
  // The hokimiyat may answer a fresh one itself (NEW -> RESOLVED, with an answer).
  [ApplicationStatus.NEW]: [
    ApplicationStatus.IN_PROGRESS,
    ApplicationStatus.RESOLVED,
    ApplicationStatus.REJECTED,
  ],
  [ApplicationStatus.IN_PROGRESS]: [
    ApplicationStatus.RESOLVED,
    ApplicationStatus.REJECTED,
  ],
  // Reopen (citizen unhappy / admin) — back to work.
  [ApplicationStatus.RESOLVED]: [ApplicationStatus.IN_PROGRESS],
  [ApplicationStatus.REJECTED]: [],
};

/**
 * SLA: how long the hokimiyat has to resolve, by kind and priority. A
 * complaint (shikoyat) is about something that went wrong — it gets half
 * the time an ordinary request (ariza) gets.
 */
export const SLA_HOURS_BY_KIND: Record<ApplicationKind, Record<Priority, number>> = {
  [ApplicationKind.ARIZA]: {
    [Priority.high]: 48,
    [Priority.medium]: 5 * 24,
    [Priority.low]: 10 * 24,
  },
  [ApplicationKind.SHIKOYAT]: {
    [Priority.high]: 24,
    [Priority.medium]: 3 * 24,
    [Priority.low]: 5 * 24,
  },
};
/** Ariza SLA (kept for callers that don't know the kind yet). */
export const SLA_HOURS: Record<Priority, number> = SLA_HOURS_BY_KIND[ApplicationKind.ARIZA];

export function slaHours(kind: ApplicationKind, priority: Priority): number {
  return SLA_HOURS_BY_KIND[kind][priority];
}

/** A citizen may reopen a resolved murojaat within this many days… */
export const REOPEN_WINDOW_DAYS = 7;
/** …and at most this many times (then it's a new murojaat / admin escalation). */
export const MAX_REOPENS = 2;

const MIN_REASON_LENGTH = 5;

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
export class ApplicationsService implements OnModuleInit {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly notify: NotificationCenter,
  ) {}

  /**
   * One-time backfill: rows filed before `kind`/`category` existed carry them
   * only in the "[SHIKOYAT|Kommunal] …" subject prefix.
   */
  async onModuleInit(): Promise<void> {
    try {
      const rows = await this.prisma.application.findMany({
        where: { category: null, subject: { startsWith: '[' } },
        select: { id: true, subject: true },
        take: 5000,
      });
      for (const r of rows) {
        await this.prisma.application.update({
          where: { id: r.id },
          data: { kind: kindOf(r.subject), category: categoryOf(r.subject) || null },
        });
      }
    } catch (e) {
      this.logger.warn(`kind backfill skipped: ${e instanceof Error ? e.message : e}`);
    }
  }

  /** The face on file for the calling citizen. */
  async citizenFace(user: AuthenticatedUser): Promise<{ photoUrl: string | null }> {
    const phone = this.citizenPhoneOf(user);
    const face = await this.prisma.citizenFace.findUnique({ where: { phone } });
    return { photoUrl: face?.photoUrl ?? null };
  }

  /** Saves (or replaces) the calling citizen's face — set at face enrollment. */
  async saveCitizenFace(user: AuthenticatedUser, photoUrl: string): Promise<{ photoUrl: string }> {
    const phone = this.citizenPhoneOf(user);
    await this.prisma.citizenFace.upsert({
      where: { phone },
      create: { phone, photoUrl },
      update: { photoUrl },
    });
    return { photoUrl };
  }

  private citizenPhoneOf(user: AuthenticatedUser): string {
    if (user?.role !== 'CITIZEN' || !user.phone) {
      throw new ForbiddenException('Faqat fuqaro uchun');
    }
    return user.phone;
  }

  /**
   * POST /applications is public, so the phone in the body is unproven. A
   * face URL is kept only when it is exactly the face that phone's owner
   * enrolled (set through their own token) — anything else is dropped.
   */
  private async provenFace(phone: string, photoUrl?: string): Promise<string | null> {
    if (!photoUrl) return null;
    const face = await this.prisma.citizenFace.findUnique({ where: { phone } });
    return face && face.photoUrl === photoUrl ? face.photoUrl : null;
  }

  async create(dto: CreateApplicationDto): Promise<Application> {
    const applicantPhotoUrl = await this.provenFace(dto.applicantPhone, dto.applicantPhotoUrl);
    const priority = dto.priority ?? Priority.medium;
    const kind = dto.kind ?? kindOf(dto.subject);
    const category = dto.category?.trim() || categoryOf(dto.subject) || null;
    const hours = slaHours(kind, priority);
    const dueAt = new Date(Date.now() + hours * 3_600_000);
    const application = await this.prisma.$transaction(async (tx) => {
      const row = await tx.application.create({
        data: { ...dto, kind, category, priority, dueAt, applicantPhotoUrl },
      });

      await tx.applicationEvent.create({
        data: {
          applicationId: row.id,
          type: ApplicationEventType.CREATED,
          toStatus: row.status,
        },
      });

      return row;
    });

    const what = kind === ApplicationKind.SHIKOYAT ? 'shikoyat' : 'murojaat';
    const title = titleOf(application.subject);
    void this.notify.admin({
      type: AdminNotificationType.request,
      title: kind === ApplicationKind.SHIKOYAT ? 'Yangi shikoyat' : 'Yangi murojaat',
      message: `${application.applicantFullName}: ${title}`,
      href: `/requests?id=${application.id}`,
    });
    void this.notify.citizen(
      application.applicantPhone,
      `${capitalize(what)}ingiz qabul qilindi`,
      `"${title}" — ${hoursText(hours)} ichida ko'rib chiqiladi. Raqami: ${shortId(application.id)}`,
      application.id,
    );
    return application;
  }

  async findAll(
    query: ListApplicationsQueryDto,
    user?: AuthenticatedUser,
  ): Promise<Paginated<ApplicationWithAssignee>> {
    const { page, limit, status, assignedTo, kind } = query;
    const where = {
      ...(status ? { status } : {}),
      ...(kind ? { kind } : {}),
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
    const note = dto.note?.trim() ?? '';

    if (isStatusChange && !allowedNextStatuses.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition application from ${application.status} to ${dto.status}`,
      );
    }
    if (isStatusChange) {
      // Rules every client gets the same way (web, worker-app):
      if (
        dto.status === ApplicationStatus.IN_PROGRESS &&
        !(dto.assignedEmployeeId ?? application.assignedEmployeeId)
      ) {
        throw new BadRequestException('Avval murojaatni xodimga biriktiring');
      }
      if (dto.status === ApplicationStatus.REJECTED && note.length < MIN_REASON_LENGTH) {
        throw new BadRequestException('Rad etish sababini yozing — fuqaro uni ko‘radi');
      }
      if (dto.status === ApplicationStatus.RESOLVED && note.length < MIN_REASON_LENGTH) {
        const staffReplied = await this.prisma.applicationMessage.count({
          where: { applicationId: id, senderRole: MessageSenderRole.EMPLOYEE },
        });
        if (staffReplied === 0) {
          throw new BadRequestException('Fuqaroga javob yozing — natija nima bo‘ldi');
        }
      }
    }
    const adminReopen =
      isStatusChange &&
      application.status === ApplicationStatus.RESOLVED &&
      dto.status === ApplicationStatus.IN_PROGRESS;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.application.update({
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
          ...(adminReopen
            ? { dueAt: reopenDueAt(application), escalatedAt: null, rating: null }
            : {}),
        },
      });

      if (isStatusChange) {
        await tx.applicationEvent.create({
          data: {
            applicationId: id,
            type: adminReopen ? ApplicationEventType.REOPENED : ApplicationEventType.STATUS_CHANGED,
            fromStatus: application.status,
            toStatus: dto.status,
            actorEmployeeId,
            note: note || null,
          },
        });
        // The reason / answer goes on the thread — the citizen reads it there.
        if (note) {
          await tx.applicationMessage.create({
            data: {
              applicationId: id,
              senderRole: MessageSenderRole.EMPLOYEE,
              senderName: 'Hokimiyat',
              text:
                dto.status === ApplicationStatus.REJECTED
                  ? `Murojaat rad etildi. Sabab: ${note}`
                  : note,
            },
          });
        }
      }

      return row;
    });

    if (isStatusChange) void this.tellCitizenAboutStatus(updated, note);
    return updated;
  }

  /** What the citizen sees in their inbox when the status moves. */
  private async tellCitizenAboutStatus(a: Application, note: string): Promise<void> {
    const title = titleOf(a.subject);
    switch (a.status) {
      case ApplicationStatus.IN_PROGRESS:
        return this.notify.citizen(a.applicantPhone, 'Murojaatingiz ko‘rib chiqilmoqda', `"${title}"`, a.id);
      case ApplicationStatus.RESOLVED:
        return this.notify.citizen(
          a.applicantPhone,
          'Murojaatingiz hal qilindi',
          `"${title}" — natijani baholang. Hal bo‘lmagan bo‘lsa, ${REOPEN_WINDOW_DAYS} kun ichida qayta ochishingiz mumkin.`,
          a.id,
        );
      case ApplicationStatus.REJECTED:
        return this.notify.citizen(
          a.applicantPhone,
          'Murojaatingiz rad etildi',
          note ? `"${title}" — sabab: ${note.slice(0, 200)}` : `"${title}"`,
          a.id,
        );
      default:
        return undefined;
    }
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
      void this.notify.employee(
        application.assignedEmployeeId,
        'Fuqarodan yangi xabar',
        `"${titleOf(application.subject)}": ${dto.text.slice(0, 120)}`,
        { type: 'application', applicationId: application.id },
      );
    }
    if (!isCitizen) {
      void this.notify.citizen(
        application.applicantPhone,
        'Hokimiyatdan yangi xabar',
        dto.text.slice(0, 160),
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
    }).then(async (updated) => {
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
        const emp = await this.prisma.employee
          .findUnique({ where: { id: dto.assignedEmployeeId }, select: { fullName: true } })
          .catch(() => null);
        void this.notify.citizen(
          application.applicantPhone,
          'Mas’ul xodim biriktirildi',
          `"${titleOf(application.subject)}" — ${emp?.fullName ?? 'xodim'} ko‘rib chiqmoqda`,
          applicationId,
        );
      }
      return updated;
    });
  }

  /** Ordered audit history for an application, with actor/target names resolved. */
  async findEvents(
    applicationId: string,
    user?: AuthenticatedUser,
  ): Promise<ApplicationEventWithNames[]> {
    // Citizens see the history of their OWN murojaat (transparency: who took
    // it and when); findOne enforces that ownership.
    await this.findOne(applicationId, user);

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
    let resolvedRow: Application | null = null;

    const message = await this.prisma.$transaction(async (tx) => {
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
        const resolved = await tx.application.update({
          where: { id: applicationId },
          data: { status: ApplicationStatus.RESOLVED, resolvedAt: new Date() },
        });
        resolvedRow = resolved;
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

    if (resolvedRow) {
      void this.tellCitizenAboutStatus(resolvedRow, dto.text);
    } else {
      void this.notify.citizen(
        application.applicantPhone,
        'Xodim javob yozdi',
        dto.text.slice(0, 160),
        applicationId,
      );
    }
    return message;
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
      void this.notify.employee(
        application.assignedEmployeeId,
        `Fuqaro baholadi: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`,
        `"${titleOf(application.subject)}"${comment ? ` — ${comment.slice(0, 100)}` : ''}`,
        { type: 'application', applicationId },
      );
    }
    if (rating <= 2) {
      void this.notify.admin({
        type: AdminNotificationType.request,
        title: `Past baho: ${rating}/5`,
        message: `"${titleOf(application.subject)}"${comment ? ` — ${comment.slice(0, 120)}` : ''}`,
        href: `/requests?id=${applicationId}`,
      });
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
    const resolvedAgoDays = application.resolvedAt
      ? (Date.now() - application.resolvedAt.getTime()) / 86_400_000
      : 0;
    if (resolvedAgoDays > REOPEN_WINDOW_DAYS) {
      throw new BadRequestException(
        `Hal qilinganiga ${REOPEN_WINDOW_DAYS} kundan oshdi — yangi murojaat yuboring`,
      );
    }
    if (application.reopenCount >= MAX_REOPENS) {
      void this.notify.admin({
        type: AdminNotificationType.request,
        title: 'Fuqaro natijadan norozi',
        message: `"${titleOf(application.subject)}" ${MAX_REOPENS} marta qayta ochilgan — rahbar nazorati kerak`,
        href: `/requests?id=${applicationId}`,
      });
      throw new BadRequestException(
        `Murojaat ${MAX_REOPENS} marta qayta ochilgan — hokimiyat rahbariyatiga xabar berildi`,
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.application.update({
        where: { id: applicationId },
        data: {
          status: ApplicationStatus.IN_PROGRESS,
          resolvedAt: null,
          rating: null,
          reopenCount: { increment: 1 },
          dueAt: reopenDueAt(application),
          escalatedAt: null,
        },
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
      void this.notify.employee(
        application.assignedEmployeeId,
        'Murojaat qayta ochildi',
        `"${titleOf(application.subject)}": ${reason.trim().slice(0, 120)}`,
        { type: 'application', applicationId },
      );
    }
    void this.notify.admin({
      type: AdminNotificationType.request,
      title: 'Murojaat qayta ochildi',
      message: `"${titleOf(application.subject)}" — ${reason.trim().slice(0, 120)}`,
      href: `/requests?id=${applicationId}`,
    });
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

  /**
   * SLA watcher: an open murojaat past its deadline is escalated ONCE —
   * admins get a bell notification, the assignee a reminder push.
   */
  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'murojaat-sla-escalation' })
  async escalateOverdue(): Promise<number> {
    const overdue = await this.prisma.application.findMany({
      where: {
        status: { in: [ApplicationStatus.NEW, ApplicationStatus.IN_PROGRESS] },
        dueAt: { lt: new Date() },
        escalatedAt: null,
      },
      include: ASSIGNEE_SELECT,
      take: 50,
    });
    for (const a of overdue) {
      await this.prisma.application.update({ where: { id: a.id }, data: { escalatedAt: new Date() } });
      const title = titleOf(a.subject);
      void this.notify.admin({
        type: AdminNotificationType.request,
        title: a.kind === ApplicationKind.SHIKOYAT ? 'Shikoyat muddati o‘tdi' : 'Murojaat muddati o‘tdi',
        message: `"${title}" — ${a.assignedEmployee?.fullName ?? 'hali biriktirilmagan'}`,
        href: `/requests?id=${a.id}`,
      });
      if (a.assignedEmployeeId) {
        void this.notify.employee(a.assignedEmployeeId, 'Murojaat muddati o‘tdi', `"${title}" — tezroq hal qiling`, {
          type: 'application',
          applicationId: a.id,
        });
      }
    }
    return overdue.length;
  }
}

/** A reopened murojaat gets half its SLA again (at least a day). */
function reopenDueAt(a: Pick<Application, 'kind' | 'priority'>): Date {
  const hours = Math.max(24, slaHours(a.kind, a.priority) / 2);
  return new Date(Date.now() + hours * 3_600_000);
}

function hoursText(h: number): string {
  return h % 24 === 0 ? `${h / 24} kun` : `${h} soat`;
}

function shortId(id: string): string {
  return `№${id.slice(0, 8).toUpperCase()}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Kind from the "[SHIKOYAT|…]" subject prefix (default ARIZA). */
export function kindOf(subject: string): ApplicationKind {
  return /^\[SHIKOYAT\|/.test(subject) ? ApplicationKind.SHIKOYAT : ApplicationKind.ARIZA;
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
