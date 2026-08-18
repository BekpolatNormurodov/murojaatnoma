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
  MessageSenderRole,
  NotificationType,
} from '@prisma/client';
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
  [ApplicationStatus.RESOLVED]: [],
  [ApplicationStatus.REJECTED]: [],
};

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateApplicationDto): Promise<Application> {
    return this.prisma.$transaction(async (tx) => {
      const application = await tx.application.create({ data: dto });

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
  ): Promise<Paginated<Application>> {
    const { page, limit, status } = query;
    const where = {
      ...(status ? { status } : {}),
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

  async addMessage(
    applicationId: string,
    dto: CreateMessageDto,
  ): Promise<ApplicationMessage> {
    await this.findOne(applicationId);
    return this.prisma.applicationMessage.create({
      data: { applicationId, ...dto },
    });
  }

  async findMessages(applicationId: string): Promise<ApplicationMessage[]> {
    await this.findOne(applicationId);
    return this.prisma.applicationMessage.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addAttachment(
    applicationId: string,
    dto: CreateAttachmentDto,
  ): Promise<Attachment> {
    await this.findOne(applicationId);
    return this.prisma.attachment.create({
      data: { applicationId, ...dto },
    });
  }

  async findAttachments(applicationId: string): Promise<Attachment[]> {
    await this.findOne(applicationId);
    return this.prisma.attachment.findMany({
      where: { applicationId },
      orderBy: { uploadedAt: 'desc' },
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

      if (dto.assignedEmployeeId) {
        await tx.notification.create({
          data: {
            employeeId: dto.assignedEmployeeId,
            title: 'Yangi murojaat biriktirildi',
            body: `"${application.subject}" murojaati sizga biriktirildi.`,
            type: NotificationType.APPLICATION,
          },
        });
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

      return message;
    });
  }
}
