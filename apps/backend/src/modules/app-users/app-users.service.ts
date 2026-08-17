import { Injectable, NotFoundException } from '@nestjs/common';
import { AppUser, Prisma } from '@prisma/client';
import { Paginated } from '../../common/interfaces/paginated.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ListAppUsersQueryDto } from './dto/list-app-users-query.dto';
import {
  AppUserActivityPoint,
  AppUserDauPoint,
  AppUserGrowthPoint,
  AppUserResponse,
  AppUserStats,
} from './interfaces/app-user-response.interface';

/** Uzbek month abbreviations, indexed 0 (Jan) .. 11 (Dec) — matches web-admin mock. */
const MONTH_LABELS = [
  "Yan",
  "Fev",
  "Mar",
  "Apr",
  "May",
  "Iyn",
  "Iyl",
  "Avg",
  "Sen",
  "Okt",
  "Noy",
  "Dek",
];

@Injectable()
export class AppUsersService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(row: AppUser): AppUserResponse {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      photo: row.photo,
      avatarColor: row.avatarColor,
      region: row.region,
      districtId: row.districtId,
      address: row.address,
      device: row.device,
      appVersion: row.appVersion,
      status: row.status,
      verified: row.verified,
      registeredAt: row.registeredAt.toISOString(),
      lastActiveAt: row.lastActiveAt.toISOString(),
      requestsCount: row.requestsCount,
      resolvedCount: row.resolvedCount,
      avgRating: row.avgRating,
      points: row.points,
      notificationsOn: row.notificationsOn,
      activity: (row.activity as unknown as AppUserActivityPoint[]) ?? [],
    };
  }

  async findAll(query: ListAppUsersQueryDto): Promise<Paginated<AppUserResponse>> {
    const { page, limit, status, device, search } = query;
    const where: Prisma.AppUserWhereInput = {
      ...(status ? { status } : {}),
      ...(device ? { device } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.appUser.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { lastActiveAt: 'desc' },
      }),
      this.prisma.appUser.count({ where }),
    ]);

    return { data: rows.map((r) => this.toResponse(r)), total, page, limit };
  }

  async findOne(id: string): Promise<AppUserResponse> {
    const row = await this.prisma.appUser.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`App user ${id} not found`);
    }
    return this.toResponse(row);
  }

  async stats(): Promise<AppUserStats> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      total,
      active,
      inactive,
      blocked,
      verified,
      android,
      ios,
      requestsAgg,
      newThisMonth,
      ratingAgg,
    ] = await Promise.all([
      this.prisma.appUser.count(),
      this.prisma.appUser.count({ where: { status: 'active' } }),
      this.prisma.appUser.count({ where: { status: 'inactive' } }),
      this.prisma.appUser.count({ where: { status: 'blocked' } }),
      this.prisma.appUser.count({ where: { verified: true } }),
      this.prisma.appUser.count({ where: { device: 'android' } }),
      this.prisma.appUser.count({ where: { device: 'ios' } }),
      this.prisma.appUser.aggregate({ _sum: { requestsCount: true } }),
      this.prisma.appUser.count({
        where: { registeredAt: { gte: monthStart, lt: nextMonthStart } },
      }),
      this.prisma.appUser.aggregate({
        _avg: { avgRating: true },
        where: { avgRating: { gt: 0 } },
      }),
    ]);

    const avgRating = ratingAgg._avg.avgRating ?? 0;

    return {
      total,
      active,
      inactive,
      blocked,
      verified,
      android,
      ios,
      totalRequests: requestsAgg._sum.requestsCount ?? 0,
      newThisMonth,
      avgRating: Math.round(avgRating * 10) / 10,
    };
  }

  /** So'nggi kunlik faol foydalanuvchilar (DAU) — barcha userlar activity nuqtalarining yig'indisi. */
  async dau(): Promise<AppUserDauPoint[]> {
    const rows = await this.prisma.appUser.findMany({ select: { activity: true } });
    const map = new Map<string, number>();
    for (const row of rows) {
      const activity = (row.activity as unknown as AppUserActivityPoint[]) ?? [];
      for (const point of activity) {
        if (point.count > 0) {
          map.set(point.date, (map.get(point.date) ?? 0) + 1);
        }
      }
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, faol]) => ({ date, faol }));
  }

  /** Oylik ro'yxatdan o'tish o'sishi (so'nggi 8 oy). */
  async growth(): Promise<AppUserGrowthPoint[]> {
    const now = new Date();
    const buckets: { key: string; label: string; yangi: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTH_LABELS[d.getMonth()], yangi: 0 });
    }

    const [rows, total] = await Promise.all([
      this.prisma.appUser.findMany({ select: { registeredAt: true } }),
      this.prisma.appUser.count(),
    ]);

    for (const row of rows) {
      const d = row.registeredAt;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = buckets.find((b) => b.key === key);
      if (bucket) {
        bucket.yangi += 1;
      }
    }

    // Simulate a pre-existing base so `jami` doesn't start at 0.
    let running = Math.max(
      0,
      total - buckets.reduce((sum, b) => sum + b.yangi, 0),
    );
    return buckets.map((b) => {
      running += b.yangi;
      return { month: b.label, yangi: b.yangi, jami: running };
    });
  }
}
