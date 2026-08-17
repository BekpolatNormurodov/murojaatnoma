import { Injectable } from '@nestjs/common';
import {
  AdminNotification,
  Camera,
  District,
  GovDocument,
  Meeting,
  NewsItem,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Mirrors `District` from web-admin/src/shared/data/types.ts. The DB row
 * carries an extra `createdAt` column that the mock shape doesn't have, so
 * it is projected away in `toDistrictDto` below.
 */
export interface DistrictDto {
  id: string;
  name: string;
  center: [number, number];
  polygon: [number, number][];
  color: string;
  population: number;
  households: number;
  areaKm2: number;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findDistricts(): Promise<DistrictDto[]> {
    const districts = await this.prisma.district.findMany({ orderBy: { name: 'asc' } });
    return districts.map((d) => this.toDistrictDto(d));
  }

  findCameras(): Promise<Camera[]> {
    return this.prisma.camera.findMany({ orderBy: { id: 'asc' } });
  }

  findMeetings(): Promise<Meeting[]> {
    return this.prisma.meeting.findMany({ orderBy: { startAt: 'asc' } });
  }

  findNews(): Promise<NewsItem[]> {
    return this.prisma.newsItem.findMany({ orderBy: { publishedAt: 'desc' } });
  }

  findDocuments(): Promise<GovDocument[]> {
    return this.prisma.govDocument.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findNotifications(): Promise<AdminNotification[]> {
    return this.prisma.adminNotification.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async unreadNotificationsCount(): Promise<{ count: number }> {
    const count = await this.prisma.adminNotification.count({ where: { read: false } });
    return { count };
  }

  private toDistrictDto(d: District): DistrictDto {
    return {
      id: d.id,
      name: d.name,
      center: d.center as unknown as [number, number],
      polygon: d.polygon as unknown as [number, number][],
      color: d.color,
      population: d.population,
      households: d.households,
      areaKm2: d.areaKm2,
    };
  }
}
