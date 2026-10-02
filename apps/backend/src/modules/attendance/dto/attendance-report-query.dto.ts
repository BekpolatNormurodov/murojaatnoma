import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DailyReportQueryDto {
  @ApiPropertyOptional({ example: '2026-08-17', description: 'Defaults to today' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;
}

export class MonthlyReportQueryDto {
  @ApiPropertyOptional({ example: 2026, description: 'Defaults to current year' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year?: number;

  @ApiPropertyOptional({
    example: 8,
    minimum: 1,
    maximum: 12,
    description: 'Defaults to current month',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;
}

export class TodayQueryDto {
  @ApiPropertyOptional({ example: '2026-08-17', description: 'Defaults to today' })
  @IsOptional()
  @IsDateString()
  date?: string;
}

/** `GET /attendance/timesheet` — tabel: har xodim × har kun (≤ 62 kun). */
export class TimesheetQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01', description: 'Start (inclusive). Default: 1st of this month.' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31', description: 'End (inclusive). Default: last day of this month.' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class RangeReportQueryDto {
  @ApiPropertyOptional({ example: '2026-08-01', description: 'Range start (inclusive). Defaults to today.' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-08-31', description: 'Range end (inclusive). Defaults to today.' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;
}
