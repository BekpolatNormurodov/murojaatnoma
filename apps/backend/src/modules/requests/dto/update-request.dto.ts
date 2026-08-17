import { ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

/** Body for `PATCH /requests/:id` — status transition and/or (re)assignment. */
export class UpdateRequestDto {
  @ApiPropertyOptional({ enum: RequestStatus })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional({ description: 'Worker id to assign this request to' })
  @IsOptional()
  @IsString()
  assignedWorkerId?: string;
}
