import { Injectable, Logger } from '@nestjs/common';
import { DevicePlatform } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FcmService } from './fcm.service';

/** A ready-to-send push payload for one recipient. */
export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * High-level push dispatcher used across the app. Resolves an employee to
 * their registered device tokens, delivers via {@link FcmService}, and prunes
 * any tokens FCM reports as dead. Every method is best-effort and never throws
 * — a failed push must never break the business flow that triggered it.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
  ) {}

  /** Register (or re-point) a device's FCM token to an employee. Idempotent. */
  async registerToken(
    employeeId: string,
    token: string,
    platform: DevicePlatform,
  ): Promise<void> {
    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { employeeId, token, platform },
      update: { employeeId, platform },
    });
  }

  /** Remove a token (e.g. on logout). Idempotent — unknown tokens are a no-op. */
  async unregisterToken(token: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({ where: { token } });
  }

  /** Fan a single push out to every device an employee owns. */
  async sendToEmployee(
    employeeId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.fcm.enabled) {
      this.logger.log(`[PUSH disabled] -> ${employeeId}: ${title} — ${body}`);
      return;
    }
    const rows = await this.prisma.deviceToken.findMany({
      where: { employeeId },
      select: { token: true },
    });
    if (rows.length === 0) {
      return;
    }
    const tokens = rows.map((r) => r.token);
    const invalid = await this.fcm.sendToTokens(tokens, title, body, data);
    await this.pruneInvalid(invalid);
  }

  /**
   * Bulk variant for schedulers (e.g. the stale-location scan). Builds a
   * per-employee payload and pushes concurrently; individual failures are
   * swallowed so one bad recipient never aborts the batch.
   */
  async sendToEmployees(
    employeeIds: string[],
    build: (employeeId: string) => PushPayload,
  ): Promise<void> {
    if (!this.fcm.enabled || employeeIds.length === 0) {
      return;
    }
    await Promise.all(
      employeeIds.map((id) => {
        const { title, body, data } = build(id);
        return this.sendToEmployee(id, title, body, data).catch(() => undefined);
      }),
    );
  }

  private async pruneInvalid(tokens: string[]): Promise<void> {
    if (tokens.length === 0) {
      return;
    }
    await this.prisma.deviceToken.deleteMany({ where: { token: { in: tokens } } });
    this.logger.log(`Pruned ${tokens.length} dead device token(s)`);
  }
}
