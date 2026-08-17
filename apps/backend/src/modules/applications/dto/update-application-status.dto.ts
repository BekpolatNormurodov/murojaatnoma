import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: ApplicationStatus, example: ApplicationStatus.IN_PROGRESS })
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;

  @ApiPropertyOptional({
    description: 'Employee id the application is being assigned to',
  })
  @IsOptional()
  @IsString()
  assignedEmployeeId?: string;
}
