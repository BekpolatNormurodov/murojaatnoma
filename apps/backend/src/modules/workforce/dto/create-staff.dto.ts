import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModuleKey, StaffRole, StaffStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { WorkScheduleDto } from './work-schedule.dto';

/**
 * Body for `POST /staff` — new admin-panel staff (RBAC user) from the
 * web-admin form. Mirrors the mock `StaffMember` shape minus `id` (the
 * server generates that). `login`/moderation fields (`lastLogin`,
 * `twoFactor`) default to a fresh account's blank state when omitted.
 */
export class CreateStaffDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  photo!: string;

  @ApiProperty()
  @IsString()
  avatarColor!: string;

  @ApiProperty({ enum: StaffRole })
  @IsEnum(StaffRole)
  role!: StaffRole;

  @ApiProperty()
  @IsString()
  position!: string;

  @ApiProperty()
  @IsString()
  department!: string;

  @ApiProperty()
  @IsString()
  email!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty({ description: "Tizimga kirish logini" })
  @IsString()
  login!: string;

  @ApiPropertyOptional({ enum: StaffStatus, description: 'Defaults to "active"' })
  @IsOptional()
  @IsEnum(StaffStatus)
  status?: StaffStatus;

  @ApiProperty({ enum: ModuleKey, isArray: true, description: "Ruxsat berilgan modullar" })
  @IsArray()
  @IsEnum(ModuleKey, { each: true })
  permissions!: ModuleKey[];

  @ApiPropertyOptional({
    type: WorkScheduleDto,
    description: 'Defaults to { start: "09:00", end: "18:00", days: [1,2,3,4,5] }',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkScheduleDto)
  schedule?: WorkScheduleDto;

  @ApiPropertyOptional({ nullable: true, description: 'ISO date-time. Defaults to null' })
  @IsOptional()
  @IsISO8601()
  lastLogin?: string | null;

  @ApiPropertyOptional({ description: 'ISO date-time. Defaults to now' })
  @IsOptional()
  @IsISO8601()
  createdAt?: string;

  @ApiPropertyOptional({ description: 'Defaults to false' })
  @IsOptional()
  @IsBoolean()
  twoFactor?: boolean;
}
