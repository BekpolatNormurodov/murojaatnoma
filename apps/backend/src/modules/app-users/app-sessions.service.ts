import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const SESSION = {
  id: true,
  startedAt: true,
  createdAt: true,
  expiresAt: true,
  device: true,
  platform: true,
  appVersion: true,
} as const;

interface TokenRow {
  id: string;
  startedAt: Date;
  createdAt: Date;
  expiresAt: Date;
  device: string | null;
  platform: string | null;
  appVersion: string | null;
}

/** A live token is one sign-in; it was last renewed when its row was created. */
const toSession = (t: TokenRow) => ({
  id: t.id,
  startedAt: t.startedAt,
  lastSeenAt: t.createdAt,
  expiresAt: t.expiresAt,
  device: t.device,
  platform: t.platform,
  appVersion: t.appVersion,
});

const latest = (dates: (Date | null | undefined)[]): Date | null =>
  dates.reduce<Date | null>((max, d) => (d && (!max || d > max) ? d : max), null);

/** Who actually uses the mobile apps, from sign-in sessions — no demo data. */
@Injectable()
export class AppSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(now = new Date()) {
    const live = { revoked: false, expiresAt: { gt: now } };
    const [employees, employeeTokens, citizenTokens, applications] = await Promise.all([
      this.prisma.employee.findMany({
        where: { isActive: true },
        select: {
          id: true,
          fullName: true,
          phone: true,
          position: true,
          avatarUrl: true,
          username: true,
          lastLocationAt: true,
          deviceStatus: true,
          deviceStatusAt: true,
        },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.refreshToken.findMany({
        where: live,
        select: { ...SESSION, employeeId: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.citizenRefreshToken.findMany({
        where: live,
        select: { ...SESSION, phone: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.application.findMany({
        select: { applicantPhone: true, applicantFullName: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const byEmployee = group(employeeTokens, (t) => t.employeeId);
    const byPhone = group(citizenTokens, (t) => t.phone);
    const filed = group(applications, (a) => a.applicantPhone);
    const phones = new Set([...byPhone.keys(), ...filed.keys()].filter(Boolean));

    return {
      employees: employees.map((e) => {
        const sessions = (byEmployee.get(e.id) ?? []).map(toSession);
        const report = e.deviceStatus as { device?: string; appVersion?: string; battery?: number } | null;
        return {
          id: e.id,
          name: e.fullName,
          phone: e.phone,
          position: e.position,
          avatarUrl: e.avatarUrl,
          username: e.username,
          device: report?.device ?? sessions.find((s) => s.device)?.device ?? null,
          appVersion: report?.appVersion ?? sessions.find((s) => s.appVersion)?.appVersion ?? null,
          battery: report?.battery ?? null,
          reportedAt: e.deviceStatusAt,
          lastSeenAt: latest([e.lastLocationAt, e.deviceStatusAt, sessions[0]?.lastSeenAt]),
          sessions,
        };
      }),
      citizens: [...phones]
        .map((phone) => {
          const sessions = (byPhone.get(phone) ?? []).map(toSession);
          const own = filed.get(phone) ?? [];
          return {
            id: phone,
            name: own.find((a) => a.applicantFullName)?.applicantFullName ?? null,
            phone,
            device: sessions.find((s) => s.device)?.device ?? null,
            appVersion: sessions.find((s) => s.appVersion)?.appVersion ?? null,
            applications: own.length,
            lastSeenAt: latest([sessions[0]?.lastSeenAt, own[0]?.createdAt]),
            sessions,
          };
        })
        .sort((a, b) => (b.lastSeenAt?.getTime() ?? 0) - (a.lastSeenAt?.getTime() ?? 0)),
    };
  }
}

function group<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(key(row));
    if (list) list.push(row);
    else map.set(key(row), [row]);
  }
  return map;
}
