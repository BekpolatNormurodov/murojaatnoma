import { Body, CanActivate, Controller, ExecutionContext, Get, Injectable, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  ListMediaQueryDto,
  MarkSeenDto,
  MediaOverviewQueryDto,
  UpdateMediaItemDto,
  UpdateMediaSettingsDto,
} from './dto/media.dto';
import { MediaMonitorService } from './media-monitor.service';

/** Admins who may change data (VIEWER is read-only). */
@Injectable()
class MediaWriterGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    return user?.scope === 'admin' && user.adminRole !== AdminRole.VIEWER;
  }
}

/**
 * OAV monitoringi — what news sites, Telegram, YouTube and Instagram say about
 * the district, scored and summarised (web-admin /media + dashboard widget).
 */
@ApiTags('media-monitor')
@ApiBearerAuth()
@RequireScope('admin')
@Controller('media')
export class MediaMonitorController {
  constructor(private readonly media: MediaMonitorService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Xulosa + raqamlar + grafik + ogohlantirishlar (dashboard uchun bitta so‘rov)' })
  overview(@Query() q: MediaOverviewQueryDto) {
    return this.media.overview(q);
  }

  @Get('items')
  @ApiOperation({ summary: 'Xabarlar lentasi (filtr + qidiruv + sahifalash)' })
  list(@Query() q: ListMediaQueryDto) {
    return this.media.list(q);
  }

  @Get('digests')
  @ApiOperation({ summary: 'Oldingi xulosalar tarixi' })
  digests(@Query('limit') limit?: string) {
    return this.media.digests(limit ? parseInt(limit, 10) || 12 : 12);
  }

  @Get('status')
  @ApiOperation({ summary: 'Monitoring holati: manbalar, oxirgi/keyingi yangilanish' })
  status() {
    return this.media.status();
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Hozir yangilash (fon rejimida, 1 daqiqada 1 marta)' })
  refresh() {
    return this.media.refresh();
  }

  @Post('digest')
  @UseGuards(MediaWriterGuard)
  @ApiOperation({ summary: 'Xulosani qayta yozish' })
  regenerateDigest() {
    return this.media.regenerateDigest();
  }

  @Patch('items/:id')
  @UseGuards(MediaWriterGuard)
  @ApiOperation({ summary: 'Xabar holati (muhim / yashirish) yoki baholashni tuzatish' })
  updateItem(@Param('id') id: string, @Body() dto: UpdateMediaItemDto) {
    return this.media.updateItem(id, dto);
  }

  @Post('items/mark-seen')
  @UseGuards(MediaWriterGuard)
  @ApiOperation({ summary: "Yangi xabarlarni ko'rilgan deb belgilash" })
  markSeen(@Body() dto: MarkSeenDto) {
    return this.media.markSeen(dto);
  }

  @Get('settings')
  @ApiOperation({ summary: "Kalit so'zlar, manbalar va ulangan integratsiyalar" })
  settings() {
    return this.media.settingsView();
  }

  @Put('settings')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: "Kalit so'zlar va manbalarni o'zgartirish — SUPER_ADMIN" })
  updateSettings(@Body() dto: UpdateMediaSettingsDto) {
    return this.media.updateSettings(dto);
  }
}
