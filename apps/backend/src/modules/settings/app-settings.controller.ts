import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { AdminWriterGuard } from '../../common/guards/admin-writer.guard';
import { AppSettingsService, AttendanceSettings } from './app-settings.service';

export class UpdateAttendanceSettingsDto {
  @ApiPropertyOptional({ description: 'Keldi/ketdi uchun yuz skaneri majburiymi' })
  @IsOptional()
  @IsBoolean()
  faceRequired?: boolean;
}

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class AppSettingsController {
  constructor(private readonly settings: AppSettingsService) {}

  @Get('attendance')
  @RequireScope('admin', 'employee')
  @ApiOperation({ summary: 'Davomat qoidalari (worker-app ham o\'qiydi: yuz skaneri kerakmi)' })
  attendance(): Promise<AttendanceSettings> {
    return this.settings.attendance();
  }

  @Patch('attendance')
  @RequireScope('admin')
  @UseGuards(AdminWriterGuard)
  @ApiOperation({ summary: 'Davomat qoidalarini o\'zgartirish — ADMIN/SUPER_ADMIN' })
  updateAttendance(@Body() dto: UpdateAttendanceSettingsDto): Promise<AttendanceSettings> {
    return this.settings.updateAttendance(dto);
  }
}
