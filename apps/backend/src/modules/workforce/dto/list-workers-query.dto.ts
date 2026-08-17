import { ApiPropertyOptional } from '@nestjs/swagger';
import { RequestCategory, WorkerStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * Filters for GET /workers. Response stays a plain `Worker[]` (drop-in for
 * the web-admin mock's `WORKERS` export) — these are optional narrowing
 * params, not a pagination envelope.
 */
export class ListWorkersQueryDto {
  @ApiPropertyOptional({ description: 'Filter by district id, e.g. "mirzo"' })
  @IsOptional()
  @IsString()
  districtId?: string;

  @ApiPropertyOptional({ enum: WorkerStatus })
  @IsOptional()
  @IsEnum(WorkerStatus)
  status?: WorkerStatus;

  @ApiPropertyOptional({
    enum: RequestCategory,
    description: 'Worker must have this category among its specialization[]',
  })
  @IsOptional()
  @IsEnum(RequestCategory)
  specialization?: RequestCategory;

  @ApiPropertyOptional({ description: 'Free-text search (name, phone, email, position)' })
  @IsOptional()
  @IsString()
  search?: string;
}
