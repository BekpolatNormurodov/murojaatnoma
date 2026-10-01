import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationKind, ApplicationStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListApplicationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ApplicationStatus })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({ enum: ['me'], description: "'me' — faqat menga biriktirilganlar (xodim)" })
  @IsOptional()
  @IsIn(['me'])
  assignedTo?: 'me';

  @ApiPropertyOptional({ enum: ApplicationKind })
  @IsOptional()
  @IsEnum(ApplicationKind)
  kind?: ApplicationKind;
}
