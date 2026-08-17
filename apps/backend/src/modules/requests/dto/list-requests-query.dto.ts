import { ApiPropertyOptional } from '@nestjs/swagger';
import { Priority, RequestCategory, RequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * Query filters for `GET /requests` (murojaatlar ro'yxati). Mirrors the
 * filters the web-admin requests table offers: category, district, status,
 * priority, plus pagination.
 */
export class ListRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RequestCategory })
  @IsOptional()
  @IsEnum(RequestCategory)
  category?: RequestCategory;

  @ApiPropertyOptional({ description: 'District id, e.g. "d1"' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ enum: RequestStatus })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}
