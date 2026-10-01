import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdminNotificationType, NotificationType } from '@prisma/client';
import { RT_EVENTS } from '../../common/events/realtime-events';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PushService } from '../push/push.service';

/**
 * One place that tells people what happened, for all three audiences:
 * - admins: the web bell (AdminNotification + a live socket event),
 * - employees: the worker-app inbox (Notification) + FCM push,
 * - citizens: the citizen-app inbox (CitizenNotification, keyed by phone).
 * Never throws — a failed notification must not fail the business action.
 */
@Injectable()
export class NotificationCenter {
  private readonly logger = new Logger(NotificationCenter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly events: EventEmitter2,
  ) {}

  async admin(n: { type: AdminNotificationType; title: string; message: string; href?: string }): Promise<void> {
    try {
      const row = await this.prisma.adminNotification.create({
        data: {
          id: `ntf-${randomUUID()}`,
          type: n.type,
          title: n.title,
          message: n.message,
          href: n.href ?? null,
          createdAt: new Date(),
          read: false,
        },
      });
      this.events.emit(RT_EVENTS.adminNotification, row);
    } catch (e) {
      this.logger.warn(`admin notification failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  async employee(
    employeeId: string,
    title: string,
    body: string,
    data: Record<string, string> = {},
  ): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: { employeeId, title, body, type: NotificationType.APPLICATION },
      });
      await this.push.sendToEmployee(employeeId, title, body, data);
    } catch (e) {
      this.logger.warn(`employee notification failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  async citizen(phone: string, title: string, body: string, applicationId?: string): Promise<void> {
    try {
      await this.prisma.citizenNotification.create({
        data: { phone, title, body, applicationId: applicationId ?? null },
      });
    } catch (e) {
      this.logger.warn(`citizen notification failed: ${e instanceof Error ? e.message : e}`);
    }
  }
}
