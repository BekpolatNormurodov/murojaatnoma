import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestCategory, WorkerStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AttendanceDayDto } from './attendance-day.dto';
import { WorkerDocumentDto } from './worker-document.dto';

/**
 * Body for `POST /workers` — new field-worker (dala ishchisi) profile from
 * the web-admin form. Mirrors the mock `Worker` shape minus `id` (the
 * server generates that). A brand-new hire wouldn't have any operational
 * history yet, so the stat/attendance-derived fields (rating, points,
 * today's check-in, attendance log, ...) are all optional and default to a
 * blank slate — only the identity/contact/role fields are required.
 */
export class CreateWorkerDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  photo!: string;

  @ApiProperty()
  @IsString()
  avatarColor!: string;

  @ApiProperty()
  @IsString()
  position!: string;

  @ApiProperty()
  @IsString()
  region!: string;

  @ApiProperty()
  @IsString()
  districtId!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiPropertyOptional({ description: 'Optional — a worker need not have an email' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ enum: RequestCategory, isArray: true })
  @IsArray()
  @IsEnum(RequestCategory, { each: true })
  specialization!: RequestCategory[];

  @ApiPropertyOptional({ enum: WorkerStatus, description: 'Defaults to "offline"' })
  @IsOptional()
  @IsEnum(WorkerStatus)
  status?: WorkerStatus;

  @ApiPropertyOptional({ description: 'Defaults to false' })
  @IsOptional()
  @IsBoolean()
  insideRegion?: boolean;

  @ApiPropertyOptional({ description: 'Defaults to 0' })
  @IsOptional()
  @IsNumber()
  rating?: number;

  @ApiPropertyOptional({ description: 'Defaults to 0' })
  @IsOptional()
  @IsNumber()
  points?: number;

  @ApiPropertyOptional({ description: 'Defaults to 0' })
  @IsOptional()
  @IsNumber()
  completedTasks?: number;

  @ApiPropertyOptional({ description: 'Defaults to 0' })
  @IsOptional()
  @IsNumber()
  activeTasks?: number;

  @ApiPropertyOptional({ description: 'Defaults to 0' })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: 'Defaults to 0' })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ description: 'ISO date-time. Defaults to now' })
  @IsOptional()
  @IsISO8601()
  hiredAt?: string;

  @ApiPropertyOptional({ nullable: true, example: '08:12' })
  @IsOptional()
  @IsString()
  checkInTime?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '17:45' })
  @IsOptional()
  @IsString()
  checkOutTime?: string | null;

  @ApiPropertyOptional({ description: 'Defaults to false' })
  @IsOptional()
  @IsBoolean()
  todayConfirmed?: boolean;

  @ApiPropertyOptional({ description: 'Defaults to 0' })
  @IsOptional()
  @IsNumber()
  attendanceRate?: number;

  @ApiPropertyOptional({ description: 'Defaults to 0' })
  @IsOptional()
  @IsNumber()
  onTimeRate?: number;

  @ApiPropertyOptional({ description: 'Defaults to 0' })
  @IsOptional()
  @IsNumber()
  monthlyHours?: number;

  @ApiPropertyOptional({ type: [AttendanceDayDto], description: 'Defaults to []' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceDayDto)
  attendance?: AttendanceDayDto[];

  @ApiPropertyOptional({ description: 'Defaults to 0' })
  @IsOptional()
  @IsNumber()
  salary?: number;

  @ApiPropertyOptional({ description: 'Defaults to 0' })
  @IsOptional()
  @IsNumber()
  bonus?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  vehicle?: string | null;

  @ApiPropertyOptional({ type: [WorkerDocumentDto], description: 'Defaults to []' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkerDocumentDto)
  documents?: WorkerDocumentDto[];
}
