import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminNotification, Camera, GovDocument, Meeting, NewsItem } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CatalogService, DistrictDto } from './catalog.service';

// NOTE: all routes are @Public() for now — auth-gating (JWT + roles) is a
// later step once the web-admin login flow is wired up.
@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get('districts')
  @ApiOperation({ summary: "Tumanlar ro'yxati (markaz/chegara geometriyasi bilan)" })
  findDistricts(): Promise<DistrictDto[]> {
    return this.catalogService.findDistricts();
  }

  @Public()
  @Get('cameras')
  @ApiOperation({ summary: "Video kuzatuv kameralari ro'yxati" })
  findCameras(): Promise<Camera[]> {
    return this.catalogService.findCameras();
  }

  @Public()
  @Get('meetings')
  @ApiOperation({ summary: "Yig'ilishlar ro'yxati" })
  findMeetings(): Promise<Meeting[]> {
    return this.catalogService.findMeetings();
  }

  @Public()
  @Get('news')
  @ApiOperation({ summary: "Yangiliklar va e'lonlar ro'yxati" })
  findNews(): Promise<NewsItem[]> {
    return this.catalogService.findNews();
  }

  @Public()
  @Get('documents')
  @ApiOperation({ summary: "Hokimiyat hujjatlari ro'yxati" })
  findDocuments(): Promise<GovDocument[]> {
    return this.catalogService.findDocuments();
  }

  @Public()
  @Get('notifications')
  @ApiOperation({ summary: "Admin panel bildirishnomalari ro'yxati" })
  findNotifications(): Promise<AdminNotification[]> {
    return this.catalogService.findNotifications();
  }

  @Public()
  @Get('notifications/unread-count')
  @ApiOperation({ summary: "O'qilmagan bildirishnomalar soni" })
  unreadNotificationsCount(): Promise<{ count: number }> {
    return this.catalogService.unreadNotificationsCount();
  }
}
