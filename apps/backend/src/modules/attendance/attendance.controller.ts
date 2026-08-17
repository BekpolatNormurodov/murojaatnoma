import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttendanceRecord, EmployeeRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  AttendanceReport,
  AttendanceService,
  EmployeeMeAttendance,
  TodayAttendance,
} from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import {
  DailyReportQueryDto,
  MonthlyReportQueryDto,
  TodayQueryDto,
} from './dto/attendance-report-query.dto';
import { VerifyFaceDto } from './dto/verify-face.dto';
import { VerifyFaceResultDto } from './dto/verify-face-result.dto';

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
  checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckInDto,
  ): Promise<AttendanceRecord> {
    return this.attendanceService.checkIn(
      this.resolveEmployeeId(user, dto.employeeId),
      dto,
    );
  }

  @Post('check-out')
  @ApiOperation({ summary: 'Record a check-out scan' })
  checkOut(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckOutDto,
  ): Promise<AttendanceRecord> {
    return this.attendanceService.checkOut(
      this.resolveEmployeeId(user, dto.employeeId),
      dto,
    );
  }

  @Post('verify-face')
  @ApiOperation({
    summary:
      "Match a live face embedding against an employee's enrolled templates " +
      '(no attendance record is written; requires authentication)',
  })
  verifyFace(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyFaceDto,
  ): Promise<VerifyFaceResultDto> {
    return this.attendanceService.verifyFace(
      this.resolveEmployeeId(user, dto.employeeId),
      dto,
    );
  }

  @Get('me')
  @ApiOperation({
    summary:
      "The authenticated employee's own attendance: today's status plus the " +
      'last 7 calendar days (oldest to newest)',
  })
  me(@CurrentUser() user: AuthenticatedUser): Promise<EmployeeMeAttendance> {
    return this.attendanceService.me(user.employeeId);
  }

  @Get('today')
  @Roles(EmployeeRole.ADMIN)
  @ApiOperation({
    summary:
      'Per-employee attendance roster for one day (davomat board): every active ' +
      'employee paired with their CHECK_IN/CHECK_OUT scan, derived status, and hours worked',
  })
  today(@Query() query: TodayQueryDto): Promise<TodayAttendance> {
    return this.attendanceService.today(query);
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

  /**
   * The scan is always recorded for the authenticated caller unless they are
   * an ADMIN explicitly targeting another employee via the body — this stops
   * a regular employee from spoofing someone else's attendance.
   */
  private resolveEmployeeId(user: AuthenticatedUser, bodyEmployeeId?: string): string {
    if (bodyEmployeeId && user.role === EmployeeRole.ADMIN) {
      return bodyEmployeeId;
    }
    return user.employeeId;
  }
}
