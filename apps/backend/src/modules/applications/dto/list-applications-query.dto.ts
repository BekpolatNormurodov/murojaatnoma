import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListApplicationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ApplicationStatus })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;
}
