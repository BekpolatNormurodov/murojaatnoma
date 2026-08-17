import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminNotification, Camera, GovDocument, Meeting, NewsItem } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
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
  @Post('cameras')
  @ApiOperation({ summary: "Yangi kamera qo'shish" })
  createCamera(@Body() dto: CreateCameraDto): Promise<Camera> {
    return this.catalogService.createCamera(dto);
  }

  @Public()
  @Patch('cameras/:id')
  @ApiOperation({ summary: 'Kamerani tahrirlash' })
  updateCamera(@Param('id') id: string, @Body() dto: UpdateCameraDto): Promise<Camera> {
    return this.catalogService.updateCamera(id, dto);
  }

  @Public()
  @Delete('cameras/:id')
  @ApiOperation({ summary: "Kamerani o'chirish" })
  removeCamera(@Param('id') id: string): Promise<{ id: string }> {
    return this.catalogService.removeCamera(id);
  }

  @Public()
  @Get('meetings')
  @ApiOperation({ summary: "Yig'ilishlar ro'yxati" })
  findMeetings(): Promise<Meeting[]> {
    return this.catalogService.findMeetings();
  }

  @Public()
  @Post('meetings')
  @ApiOperation({ summary: "Yangi yig'ilish rejalashtirish" })
  createMeeting(@Body() dto: CreateMeetingDto): Promise<Meeting> {
    return this.catalogService.createMeeting(dto);
  }

  @Public()
  @Patch('meetings/:id')
  @ApiOperation({ summary: "Yig'ilishni tahrirlash" })
  updateMeeting(@Param('id') id: string, @Body() dto: UpdateMeetingDto): Promise<Meeting> {
    return this.catalogService.updateMeeting(id, dto);
  }

  @Public()
  @Delete('meetings/:id')
  @ApiOperation({ summary: "Yig'ilishni o'chirish" })
  removeMeeting(@Param('id') id: string): Promise<{ id: string }> {
    return this.catalogService.removeMeeting(id);
  }

  @Public()
  @Get('news')
  @ApiOperation({ summary: "Yangiliklar va e'lonlar ro'yxati" })
  findNews(): Promise<NewsItem[]> {
    return this.catalogService.findNews();
  }

  @Public()
  @Post('news')
  @ApiOperation({ summary: "Yangi yangilik/e'lon qo'shish" })
  createNews(@Body() dto: CreateNewsDto): Promise<NewsItem> {
    return this.catalogService.createNews(dto);
  }

  @Public()
  @Patch('news/:id')
  @ApiOperation({ summary: "Yangilikni tahrirlash" })
  updateNews(@Param('id') id: string, @Body() dto: UpdateNewsDto): Promise<NewsItem> {
    return this.catalogService.updateNews(id, dto);
  }

  @Public()
  @Delete('news/:id')
  @ApiOperation({ summary: "Yangilikni o'chirish" })
  removeNews(@Param('id') id: string): Promise<{ id: string }> {
    return this.catalogService.removeNews(id);
  }

  @Public()
  @Get('documents')
  @ApiOperation({ summary: "Hokimiyat hujjatlari ro'yxati" })
  findDocuments(): Promise<GovDocument[]> {
    return this.catalogService.findDocuments();
  }

  @Public()
  @Post('documents')
  @ApiOperation({ summary: "Yangi hujjat qo'shish" })
  createDocument(@Body() dto: CreateDocumentDto): Promise<GovDocument> {
    return this.catalogService.createDocument(dto);
  }

  @Public()
  @Patch('documents/:id')
  @ApiOperation({ summary: 'Hujjatni tahrirlash' })
  updateDocument(@Param('id') id: string, @Body() dto: UpdateDocumentDto): Promise<GovDocument> {
    return this.catalogService.updateDocument(id, dto);
  }

  @Public()
  @Delete('documents/:id')
  @ApiOperation({ summary: "Hujjatni o'chirish" })
  removeDocument(@Param('id') id: string): Promise<{ id: string }> {
    return this.catalogService.removeDocument(id);
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
