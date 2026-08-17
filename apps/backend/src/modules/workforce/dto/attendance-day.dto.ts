import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

/**
 * Mirrors `AttendanceDay` from web-admin/src/shared/data/types.ts — a single
 * day inside `Worker.attendance` (a Prisma `Json` column, so this is only a
 * type-level/validation view of what's stored there, same shape the seed
 * already writes via `buildAttendance()`).
 */
export class AttendanceDayDto {
  @ApiProperty({ description: 'ISO date (YYYY-MM-DD)' })
  @IsString()
  date!: string;

  @ApiPropertyOptional({ nullable: true, example: '08:12' })
  @IsOptional()
  @IsString()
  checkIn?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '17:45' })
  @IsOptional()
  @IsString()
  checkOut?: string | null;

  @ApiProperty({ enum: ['present', 'late', 'absent', 'leave'] })
  @IsIn(['present', 'late', 'absent', 'leave'])
  status!: 'present' | 'late' | 'absent' | 'leave';

  @ApiProperty()
  @IsNumber()
  hours!: number;

  @ApiProperty()
  @IsBoolean()
  insideGeofence!: boolean;

  @ApiProperty()
  @IsBoolean()
  selfConfirmed!: boolean;

  @ApiPropertyOptional({ nullable: true, example: '08:15' })
  @IsOptional()
  @IsString()
  confirmedAt?: string | null;
}
