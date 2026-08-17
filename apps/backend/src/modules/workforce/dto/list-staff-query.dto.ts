import { ApiPropertyOptional } from '@nestjs/swagger';
import { StaffRole, StaffStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * Filters for GET /staff. Response stays a plain `StaffMember[]` (drop-in
 * for the web-admin mock's `STAFF` export).
 */
export class ListStaffQueryDto {
  @ApiPropertyOptional({ enum: StaffRole })
  @IsOptional()
  @IsEnum(StaffRole)
  role?: StaffRole;

  @ApiPropertyOptional({ enum: StaffStatus })
  @IsOptional()
  @IsEnum(StaffStatus)
  status?: StaffStatus;

  @ApiPropertyOptional({ description: 'Filter by department, e.g. "Devonxona"' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Free-text search (name, phone, email, login, position)' })
  @IsOptional()
  @IsString()
  search?: string;
}
