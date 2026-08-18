import { Injectable } from '@nestjs/common';
import { Notification, NotificationType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PushService } from '../push/push.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: dto,
    });

    // Fire-and-forget push: a delivery failure must never fail the write.
    void this.pushService
      .sendToEmployee(dto.employeeId, dto.title, dto.body, {
        type: dto.type ?? NotificationType.GENERAL,
      })
      .catch(() => undefined);

    return notification;
  }

  findAllForEmployee(employeeId: string): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  markAsRead(id: string): Promise<Notification> {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }
}
