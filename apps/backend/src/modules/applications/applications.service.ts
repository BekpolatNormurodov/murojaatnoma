import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Application,
  ApplicationMessage,
  ApplicationStatus,
  Attachment,
} from '@prisma/client';
import { Paginated } from '../../common/interfaces/paginated.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

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

  create(dto: CreateApplicationDto): Promise<Application> {
    return this.prisma.application.create({ data: dto });
  }

  async findAll(query: ListApplicationsQueryDto): Promise<Paginated<Application>> {
    const { page, limit, status } = query;
    const where = status ? { status } : {};

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

  async findOne(id: string): Promise<Application> {
    const application = await this.prisma.application.findUnique({
      where: { id },
    });
    if (!application) {
      throw new NotFoundException(`Application ${id} not found`);
    }
    return application;
  }

  async updateStatus(id: string, dto: UpdateApplicationStatusDto): Promise<Application> {
    const application = await this.findOne(id);
    const allowedNextStatuses = ALLOWED_TRANSITIONS[application.status];

    if (dto.status !== application.status && !allowedNextStatuses.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition application from ${application.status} to ${dto.status}`,
      );
    }

    return this.prisma.application.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.assignedEmployeeId ? { assignedEmployeeId: dto.assignedEmployeeId } : {}),
      },
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
}
