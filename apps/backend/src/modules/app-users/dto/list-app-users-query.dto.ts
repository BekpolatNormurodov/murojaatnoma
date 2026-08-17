import { ApiPropertyOptional } from '@nestjs/swagger';
import { AppUserDevice, AppUserStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * Query params for GET /app-users. Only `page`/`limit` are required by the
 * web-admin mock contract; status/device/search are additive, optional
 * filters that don't change the response shape.
 */
export class ListAppUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AppUserStatus })
  @IsOptional()
  @IsEnum(AppUserStatus)
  status?: AppUserStatus;

  @ApiPropertyOptional({ enum: AppUserDevice })
  @IsOptional()
  @IsEnum(AppUserDevice)
  device?: AppUserDevice;

  @ApiPropertyOptional({ description: 'Matches against name or phone' })
  @IsOptional()
  @IsString()
  search?: string;
}
