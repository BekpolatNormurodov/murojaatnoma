import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CreateDailyReportDto,
  DaysQueryDto,
  ListReportsQueryDto,
  RangeQueryDto,
} from './dto';
import { ReportsService } from './reports.service';

/**
 * Kunlik hisobotlar + hududda yurgan vaqt.
 * `my/*` — worker-app (xodimning o'zi); qolgani — web-admin.
 */
@ApiTags('daily-reports')
@ApiBearerAuth()
@RequireScope('admin')
@Controller('daily-reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  // --- Xodim (worker-app) — har biri chaqiruvchining o'z id'siga bog'langan ---

  @Post()
  @RequireScope('employee')
  @ApiOperation({ summary: 'Kunlik hisobot yuborish (matn va/yoki ovoz, video, rasm, hujjat)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDailyReportDto) {
    return this.reports.create(user.employeeId, dto);
  }

  @Get('my')
  @RequireScope('employee')
  @ApiOperation({ summary: "O'z hisobotlarim (?days=1..31, default 30)" })
  mine(@CurrentUser() user: AuthenticatedUser, @Query() q: DaysQueryDto) {
    return this.reports.mine(user.employeeId, q.days ?? 30);
  }

  @Get('my/zone-time')
  @RequireScope('employee')
  @ApiOperation({ summary: "O'zim hududda necha soat bo'ldim (?days=1..31, default 8)" })
  myZoneTime(@CurrentUser() user: AuthenticatedUser, @Query() q: DaysQueryDto) {
    return this.reports.zoneTime(user.employeeId, q.days ?? 8);
  }

  @Delete('my/:id')
  @RequireScope('employee')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "O'z hisobotimni o'chirish (faqat yuborilgan kuni)" })
  removeMine(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.reports.removeMine(user.employeeId, id);
  }

  // --- Admin ---

  @Get()
  @ApiOperation({
    summary:
      "Hisobotlar ro'yxati (?from&to&employeeId&limit&offset; default: to-7 dan, ya'ni 8 kun; limit 1000)",
  })
  list(@Query() q: ListReportsQueryDto) {
    return this.reports.list(q);
  }

  @Get('activity')
  @ApiOperation({
    summary: 'Har bir xodim bo\'yicha davr yakuni: mahallalar, hisobot kunlari, hududda/faol vaqt, ish vaqti',
  })
  activity(@Query() q: RangeQueryDto) {
    return this.reports.activity(q);
  }

  @Get('activity/daily')
  @ApiOperation({
    summary:
      "Kunma-kun faollik: har bir xodim × har bir kun (keldi/ketdi, hisobotlar, hudud/ofis vaqti, oraliqlar); ko'pi bilan 31 kun",
  })
  activityDaily(@Query() q: RangeQueryDto) {
    return this.reports.activityDaily(q);
  }

  @Get('employee/:id/zone-time')
  @ApiOperation({
    summary:
      'Xodim hududda necha soat yurgani — kunma-kun, vaqt oraliqlari bilan (?days=1..31, default 8)',
  })
  zoneTime(@Param('id') id: string, @Query() q: DaysQueryDto) {
    return this.reports.zoneTime(id, q.days ?? 8);
  }
}
