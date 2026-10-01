import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

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

  @ApiPropertyOptional({
    description:
      'Reason / answer for the citizen — REQUIRED for REJECTED, and for RESOLVED unless staff already replied on the thread',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
