import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AdminNotification,
  Camera,
  CameraStatus,
  District,
  GovDocStatus,
  GovDocument,
  Meeting,
  MeetingStatus,
  NewsItem,
  NewsStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCameraDto } from './dto/create-camera.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { UpdateNewsDto } from './dto/update-news.dto';

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

  /**
   * `POST /cameras` — new CCTV camera registered from web-admin. The server
   * always generates `id` (seed uses `CAM-${pad(i)}`; live rows use a
   * timestamp-based id in the same `CAM-` family so both stay collision-free
   * and sortable).
   */
  createCamera(dto: CreateCameraDto): Promise<Camera> {
    return this.prisma.camera.create({
      data: {
        id: `CAM-${Date.now()}`,
        name: dto.name,
        region: dto.region,
        districtId: dto.districtId,
        type: dto.type,
        status: dto.status ?? CameraStatus.online,
        lat: dto.lat,
        lng: dto.lng,
        resolution: dto.resolution ?? '1080p',
        recording: dto.recording ?? true,
        uptime: dto.uptime ?? 100,
        detections24h: dto.detections24h ?? 0,
        lastEvent: dto.lastEvent ?? null,
        installedAt: dto.installedAt ?? new Date().toISOString(),
      },
    });
  }

  /** `PATCH /cameras/:id` — edit any field of an existing camera. */
  async updateCamera(id: string, dto: UpdateCameraDto): Promise<Camera> {
    await this.getCameraOrThrow(id);
    return this.prisma.camera.update({ where: { id }, data: dto });
  }

  /** `DELETE /cameras/:id` — hard delete (no soft-delete field on `Camera`). */
  async removeCamera(id: string): Promise<{ id: string }> {
    await this.getCameraOrThrow(id);
    await this.prisma.camera.delete({ where: { id } });
    return { id };
  }

  private async getCameraOrThrow(id: string): Promise<Camera> {
    const camera = await this.prisma.camera.findUnique({ where: { id } });
    if (!camera) {
      throw new NotFoundException(`Camera ${id} not found`);
    }
    return camera;
  }

  findMeetings(): Promise<Meeting[]> {
    return this.prisma.meeting.findMany({ orderBy: { startAt: 'asc' } });
  }

  /**
   * `POST /meetings` — new yig'ilish scheduled from web-admin. The server
   * always generates `id` (seed uses `YIG-${3000 + i}`; live rows use a
   * timestamp-based id in the same `YIG-` family, matching what the
   * web-admin `meetings` store already generated client-side before this
   * endpoint existed).
   */
  createMeeting(dto: CreateMeetingDto): Promise<Meeting> {
    return this.prisma.meeting.create({
      data: {
        id: `YIG-${Date.now()}`,
        title: dto.title,
        type: dto.type,
        status: dto.status ?? MeetingStatus.scheduled,
        startAt: dto.startAt,
        durationMin: dto.durationMin,
        location: dto.location,
        chairDeputyId: dto.chairDeputyId,
        agenda: dto.agenda,
        participants: dto.participants,
        districtId: dto.districtId,
      },
    });
  }

  /** `PATCH /meetings/:id` — edit any field of an existing meeting. */
  async updateMeeting(id: string, dto: UpdateMeetingDto): Promise<Meeting> {
    await this.getMeetingOrThrow(id);
    return this.prisma.meeting.update({ where: { id }, data: dto });
  }

  /** `DELETE /meetings/:id` — hard delete (no soft-delete field on `Meeting`). */
  async removeMeeting(id: string): Promise<{ id: string }> {
    await this.getMeetingOrThrow(id);
    await this.prisma.meeting.delete({ where: { id } });
    return { id };
  }

  private async getMeetingOrThrow(id: string): Promise<Meeting> {
    const meeting = await this.prisma.meeting.findUnique({ where: { id } });
    if (!meeting) {
      throw new NotFoundException(`Meeting ${id} not found`);
    }
    return meeting;
  }

  findNews(): Promise<NewsItem[]> {
    return this.prisma.newsItem.findMany({ orderBy: { publishedAt: 'desc' } });
  }

  /**
   * `POST /news` — new yangilik/e'lon published from web-admin. The server
   * always generates `id` (seed uses `n${i + 1}`; live rows use a
   * timestamp-based id in the same `n` family so both stay collision-free).
   */
  createNews(dto: CreateNewsDto): Promise<NewsItem> {
    return this.prisma.newsItem.create({
      data: {
        id: `n${Date.now()}`,
        title: dto.title,
        excerpt: dto.excerpt,
        body: dto.body,
        category: dto.category,
        status: dto.status ?? NewsStatus.published,
        cover: dto.cover,
        author: dto.author,
        publishedAt: dto.publishedAt ?? new Date().toISOString(),
        views: dto.views ?? 0,
        featured: dto.featured ?? false,
      },
    });
  }

  /** `PATCH /news/:id` — edit any field of an existing news item. */
  async updateNews(id: string, dto: UpdateNewsDto): Promise<NewsItem> {
    await this.getNewsOrThrow(id);
    return this.prisma.newsItem.update({ where: { id }, data: dto });
  }

  /** `DELETE /news/:id` — hard delete (no soft-delete field on `NewsItem`). */
  async removeNews(id: string): Promise<{ id: string }> {
    await this.getNewsOrThrow(id);
    await this.prisma.newsItem.delete({ where: { id } });
    return { id };
  }

  private async getNewsOrThrow(id: string): Promise<NewsItem> {
    const news = await this.prisma.newsItem.findUnique({ where: { id } });
    if (!news) {
      throw new NotFoundException(`News item ${id} not found`);
    }
    return news;
  }

  findDocuments(): Promise<GovDocument[]> {
    return this.prisma.govDocument.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /**
   * `POST /documents` — new hokimiyat hujjati registered from web-admin.
   * The server always generates `id` (seed uses `D-${i + 1}`; live rows use
   * a timestamp-based id in the same `D-` family so both stay
   * collision-free).
   */
  createDocument(dto: CreateDocumentDto): Promise<GovDocument> {
    return this.prisma.govDocument.create({
      data: {
        id: `D-${Date.now()}`,
        code: dto.code,
        title: dto.title,
        type: dto.type,
        status: dto.status ?? GovDocStatus.draft,
        author: dto.author,
        region: dto.region,
        createdAt: dto.createdAt ?? new Date().toISOString(),
        sizeKb: dto.sizeKb,
        pages: dto.pages,
      },
    });
  }

  /** `PATCH /documents/:id` — edit any field of an existing document. */
  async updateDocument(id: string, dto: UpdateDocumentDto): Promise<GovDocument> {
    await this.getDocumentOrThrow(id);
    return this.prisma.govDocument.update({ where: { id }, data: dto });
  }

  /** `DELETE /documents/:id` — hard delete (no soft-delete field on `GovDocument`). */
  async removeDocument(id: string): Promise<{ id: string }> {
    await this.getDocumentOrThrow(id);
    await this.prisma.govDocument.delete({ where: { id } });
    return { id };
  }

  private async getDocumentOrThrow(id: string): Promise<GovDocument> {
    const doc = await this.prisma.govDocument.findUnique({ where: { id } });
    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    return doc;
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
