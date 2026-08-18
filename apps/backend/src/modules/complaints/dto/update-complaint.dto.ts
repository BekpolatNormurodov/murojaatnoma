import { ApiPropertyOptional } from '@nestjs/swagger';
import { ComplaintStatus, RequestCategory } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateComplaintDto {
  @ApiPropertyOptional({ enum: ComplaintStatus })
  @IsOptional()
  @IsEnum(ComplaintStatus)
  status?: ComplaintStatus;

  @ApiPropertyOptional({ enum: RequestCategory })
  @IsOptional()
  @IsEnum(RequestCategory)
  category?: RequestCategory;
}
