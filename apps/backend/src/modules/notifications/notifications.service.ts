import { Injectable } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { PushProvider } from './providers/push.provider';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushProvider: PushProvider,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: dto,
    });

    this.pushProvider.send(dto.employeeId, dto.title, dto.body);

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
