import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { NotificationType } from '@prisma/client';
import { AppConfig } from '../../common/config/configuration';
import { STALE_LOCATION_CRON } from '../../common/config/constants';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Uzbekistan is UTC+5 year-round (no daylight saving). */
const UZ_UTC_OFFSET_HOURS = 5;

/**
 * Periodically scans for active employees whose location has gone stale
 * ("yarim soatda bolmasa xabar berilsin") and raises a one-off notification
 * per stale episode. The episode resets when the employee reports again
 * (LocationsService clears `staleAlertedAt`).
 */
@Injectable()
export class LocationStaleService {
  private readonly logger = new Logger(LocationStaleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Cron(STALE_LOCATION_CRON, { name: 'location-stale-scan' })
  async scanForStaleLocations(): Promise<void> {
    if (!this.withinWorkHours(new Date())) {
      return;
    }

    const staleMinutes = this.config.get('location', { infer: true }).staleMinutes;
    const threshold = new Date(Date.now() - staleMinutes * 60_000);

    const stale = await this.prisma.employee.findMany({
      where: {
        isActive: true,
        staleAlertedAt: null,
        OR: [{ lastLocationAt: { lt: threshold } }, { lastLocationAt: null }],
      },
      select: { id: true, fullName: true, lastLocationAt: true },
    });

    if (stale.length === 0) {
      return;
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.notification.createMany({
        data: stale.map((e) => ({
          employeeId: e.id,
          title: 'Lokatsiya aniqlanmadi',
          body: e.lastLocationAt
            ? `${staleMinutes} daqiqadan beri joylashuvingiz serverga kelmadi. Iltimos ilovani oching va internet aloqasini tekshiring.`
            : 'Bugun joylashuvingiz hali aniqlanmadi. Iltimos ilovani oching va joylashuvga ruxsat bering.',
          type: NotificationType.LOCATION,
        })),
      }),
      this.prisma.employee.updateMany({
        where: { id: { in: stale.map((e) => e.id) } },
        data: { staleAlertedAt: now },
      }),
    ]);

    this.logger.warn(`Raised location-stale alerts for ${stale.length} employee(s)`);
  }

  private withinWorkHours(now: Date): boolean {
    const work = this.config.get('work', { infer: true });
    const local = new Date(now.getTime() + UZ_UTC_OFFSET_HOURS * 3_600_000);
    const day = local.getUTCDay(); // 0=Sun .. 6=Sat on the +5-shifted clock
    if (day === 0 || day === 6) {
      return false; // weekend
    }
    const minutesNow = local.getUTCHours() * 60 + local.getUTCMinutes();
    const [startH, startM] = work.startTime.split(':').map(Number);
    const [endH, endM] = work.endTime.split(':').map(Number);
    return minutesNow >= startH * 60 + startM && minutesNow <= endH * 60 + endM;
  }
}
