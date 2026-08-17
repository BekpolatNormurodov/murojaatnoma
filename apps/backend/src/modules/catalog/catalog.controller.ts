import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminNotification, Camera, GovDocument, Meeting, NewsItem } from '@prisma/client';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { CatalogService, DistrictDto } from './catalog.service';
import { CreateCameraDto } from './dto/create-camera.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { UpdateNewsDto } from './dto/update-news.dto';

// NOTE: all routes are @Public() for now — auth-gating (JWT + roles) is a
// later step once the web-admin login flow is wired up.
@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @RequireScope('admin')
  @Get('districts')
  @ApiOperation({ summary: "Tumanlar ro'yxati (markaz/chegara geometriyasi bilan)" })
  findDistricts(): Promise<DistrictDto[]> {
    return this.catalogService.findDistricts();
  }

  @RequireScope('admin')
  @Get('cameras')
  @ApiOperation({ summary: "Video kuzatuv kameralari ro'yxati" })
  findCameras(): Promise<Camera[]> {
    return this.catalogService.findCameras();
  }

  @RequireScope('admin')
  @Post('cameras')
  @ApiOperation({ summary: "Yangi kamera qo'shish" })
  createCamera(@Body() dto: CreateCameraDto): Promise<Camera> {
    return this.catalogService.createCamera(dto);
  }

  @RequireScope('admin')
  @Patch('cameras/:id')
  @ApiOperation({ summary: 'Kamerani tahrirlash' })
  updateCamera(@Param('id') id: string, @Body() dto: UpdateCameraDto): Promise<Camera> {
    return this.catalogService.updateCamera(id, dto);
  }

  @RequireScope('admin')
  @Delete('cameras/:id')
  @ApiOperation({ summary: "Kamerani o'chirish" })
  removeCamera(@Param('id') id: string): Promise<{ id: string }> {
    return this.catalogService.removeCamera(id);
  }

  @RequireScope('admin', 'employee')
  @Get('meetings')
  @ApiOperation({ summary: "Yig'ilishlar ro'yxati" })
  findMeetings(): Promise<Meeting[]> {
    return this.catalogService.findMeetings();
  }

  @RequireScope('admin')
  @Post('meetings')
  @ApiOperation({ summary: "Yangi yig'ilish rejalashtirish" })
  createMeeting(@Body() dto: CreateMeetingDto): Promise<Meeting> {
    return this.catalogService.createMeeting(dto);
  }

  @RequireScope('admin')
  @Patch('meetings/:id')
  @ApiOperation({ summary: "Yig'ilishni tahrirlash" })
  updateMeeting(@Param('id') id: string, @Body() dto: UpdateMeetingDto): Promise<Meeting> {
    return this.catalogService.updateMeeting(id, dto);
  }

  @RequireScope('admin')
  @Delete('meetings/:id')
  @ApiOperation({ summary: "Yig'ilishni o'chirish" })
  removeMeeting(@Param('id') id: string): Promise<{ id: string }> {
    return this.catalogService.removeMeeting(id);
  }

  @RequireScope('admin', 'employee')
  @Get('news')
  @ApiOperation({ summary: "Yangiliklar va e'lonlar ro'yxati" })
  findNews(): Promise<NewsItem[]> {
    return this.catalogService.findNews();
  }

  @RequireScope('admin')
  @Post('news')
  @ApiOperation({ summary: "Yangi yangilik/e'lon qo'shish" })
  createNews(@Body() dto: CreateNewsDto): Promise<NewsItem> {
    return this.catalogService.createNews(dto);
  }

  @RequireScope('admin')
  @Patch('news/:id')
  @ApiOperation({ summary: "Yangilikni tahrirlash" })
  updateNews(@Param('id') id: string, @Body() dto: UpdateNewsDto): Promise<NewsItem> {
    return this.catalogService.updateNews(id, dto);
  }

  @RequireScope('admin')
  @Delete('news/:id')
  @ApiOperation({ summary: "Yangilikni o'chirish" })
  removeNews(@Param('id') id: string): Promise<{ id: string }> {
    return this.catalogService.removeNews(id);
  }

  @RequireScope('admin', 'employee')
  @Get('documents')
  @ApiOperation({ summary: "Hokimiyat hujjatlari ro'yxati" })
  findDocuments(): Promise<GovDocument[]> {
    return this.catalogService.findDocuments();
  }

  @RequireScope('admin')
  @Post('documents')
  @ApiOperation({ summary: "Yangi hujjat qo'shish" })
  createDocument(@Body() dto: CreateDocumentDto): Promise<GovDocument> {
    return this.catalogService.createDocument(dto);
  }

  @RequireScope('admin')
  @Patch('documents/:id')
  @ApiOperation({ summary: 'Hujjatni tahrirlash' })
  updateDocument(@Param('id') id: string, @Body() dto: UpdateDocumentDto): Promise<GovDocument> {
    return this.catalogService.updateDocument(id, dto);
  }

  @RequireScope('admin')
  @Delete('documents/:id')
  @ApiOperation({ summary: "Hujjatni o'chirish" })
  removeDocument(@Param('id') id: string): Promise<{ id: string }> {
    return this.catalogService.removeDocument(id);
  }

  @RequireScope('admin')
  @Get('notifications')
  @ApiOperation({ summary: "Admin panel bildirishnomalari ro'yxati" })
  findNotifications(): Promise<AdminNotification[]> {
    return this.catalogService.findNotifications();
  }

  @RequireScope('admin')
  @Get('notifications/unread-count')
  @ApiOperation({ summary: "O'qilmagan bildirishnomalar soni" })
  unreadNotificationsCount(): Promise<{ count: number }> {
    return this.catalogService.unreadNotificationsCount();
  }
}
