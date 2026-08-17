import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttendanceRecord } from '@prisma/client';
import { AttendanceReport, AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import {
  DailyReportQueryDto,
  MonthlyReportQueryDto,
} from './dto/attendance-report-query.dto';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @ApiOperation({
    summary:
      'Record a check-in scan (accepted only if face score and GPS pass geofence rules)',
  })
  checkIn(@Body() dto: CheckInDto): Promise<AttendanceRecord> {
    return this.attendanceService.checkIn(dto);
  }

  @Post('check-out')
  @ApiOperation({ summary: 'Record a check-out scan' })
  checkOut(@Body() dto: CheckOutDto): Promise<AttendanceRecord> {
    return this.attendanceService.checkOut(dto);
  }

  @Get('report/daily')
  @ApiOperation({ summary: 'Daily attendance report, optionally filtered by employee' })
  dailyReport(@Query() query: DailyReportQueryDto): Promise<AttendanceReport> {
    return this.attendanceService.dailyReport(query);
  }

  @Get('report/monthly')
  @ApiOperation({ summary: 'Monthly attendance report, optionally filtered by employee' })
  monthlyReport(@Query() query: MonthlyReportQueryDto): Promise<AttendanceReport> {
    return this.attendanceService.monthlyReport(query);
  }
}
