import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttendanceRecord, AttendanceType } from '@prisma/client';
import { AppConfig } from '../../common/config/configuration';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import {
  DailyReportQueryDto,
  MonthlyReportQueryDto,
} from './dto/attendance-report-query.dto';
import { distanceInMeters } from './utils/geo.util';

export interface EmployeeDailySummary {
  employeeId: string;
  firstCheckIn: Date | null;
  lastCheckOut: Date | null;
  validScans: number;
  invalidScans: number;
}

export interface AttendanceReport {
  from: Date;
  to: Date;
  totalRecords: number;
  perEmployee: EmployeeDailySummary[];
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  checkIn(dto: CheckInDto): Promise<AttendanceRecord> {
    return this.recordScan(AttendanceType.CHECK_IN, dto);
  }

  checkOut(dto: CheckOutDto): Promise<AttendanceRecord> {
    return this.recordScan(AttendanceType.CHECK_OUT, dto);
  }

  async dailyReport(query: DailyReportQueryDto): Promise<AttendanceReport> {
    const day = query.date ? new Date(query.date) : new Date();
    const from = new Date(day);
    from.setHours(0, 0, 0, 0);
    const to = new Date(day);
    to.setHours(23, 59, 59, 999);

    return this.buildReport(from, to, query.employeeId);
  }

  async monthlyReport(query: MonthlyReportQueryDto): Promise<AttendanceReport> {
    const now = new Date();
    const year = query.year ?? now.getFullYear();
    const month = (query.month ?? now.getMonth() + 1) - 1;

    const from = new Date(year, month, 1, 0, 0, 0, 0);
    const to = new Date(year, month + 1, 0, 23, 59, 59, 999);

    return this.buildReport(from, to, query.employeeId);
  }

  private async recordScan(
    type: AttendanceType,
    dto: CheckInDto,
  ): Promise<AttendanceRecord> {
    const { faceMatchThreshold, geofenceRadiusM, officeLatitude, officeLongitude } =
      this.configService.get('attendance', { infer: true });

    const distance = distanceInMeters(
      dto.latitude,
      dto.longitude,
      officeLatitude,
      officeLongitude,
    );

    const faceOk = dto.faceScore >= faceMatchThreshold;
    const locationOk = distance <= geofenceRadiusM;
    const isValid = faceOk && locationOk;

    const reasons: string[] = [];
    if (!faceOk) {
      reasons.push(
        `face score ${dto.faceScore.toFixed(2)} below threshold ${faceMatchThreshold}`,
      );
    }
    if (!locationOk) {
      reasons.push(
        `${distance.toFixed(0)}m from office, outside ${geofenceRadiusM}m geofence`,
      );
    }

    return this.prisma.attendanceRecord.create({
      data: {
        employeeId: dto.employeeId,
        type,
        faceScore: dto.faceScore,
        latitude: dto.latitude,
        longitude: dto.longitude,
        isValid,
        reason: reasons.length > 0 ? reasons.join('; ') : null,
      },
    });
  }

  private async buildReport(
    from: Date,
    to: Date,
    employeeId?: string,
  ): Promise<AttendanceReport> {
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        recordedAt: { gte: from, lte: to },
        ...(employeeId ? { employeeId } : {}),
      },
      orderBy: { recordedAt: 'asc' },
    });

    const byEmployee = new Map<string, EmployeeDailySummary>();

    for (const record of records) {
      let summary = byEmployee.get(record.employeeId);
      if (!summary) {
        summary = {
          employeeId: record.employeeId,
          firstCheckIn: null,
          lastCheckOut: null,
          validScans: 0,
          invalidScans: 0,
        };
        byEmployee.set(record.employeeId, summary);
      }

      if (record.isValid) {
        summary.validScans += 1;
      } else {
        summary.invalidScans += 1;
      }

      if (record.type === AttendanceType.CHECK_IN && !summary.firstCheckIn) {
        summary.firstCheckIn = record.recordedAt;
      }
      if (record.type === AttendanceType.CHECK_OUT) {
        summary.lastCheckOut = record.recordedAt;
      }
    }

    return {
      from,
      to,
      totalRecords: records.length,
      perEmployee: Array.from(byEmployee.values()),
    };
  }
}
