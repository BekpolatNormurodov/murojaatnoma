import { ApiPropertyOptional } from '@nestjs/swagger';
import { ComplaintSeverity, ComplaintStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListComplaintsQueryDto {
  @ApiPropertyOptional({ enum: ComplaintStatus })
  @IsOptional()
  @IsEnum(ComplaintStatus)
  status?: ComplaintStatus;

  @ApiPropertyOptional({ enum: ComplaintSeverity })
  @IsOptional()
  @IsEnum(ComplaintSeverity)
  severity?: ComplaintSeverity;
}
