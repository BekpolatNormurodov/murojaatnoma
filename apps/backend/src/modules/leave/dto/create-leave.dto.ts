import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/** The two kinds of leave a worker-app request can be made in. */
export type LeaveTypeValue = 'hours' | 'days';

export class CreateLeaveDto {
  @ApiProperty({ enum: ['hours', 'days'], example: 'days' })
  @IsIn(['hours', 'days'])
  type!: LeaveTypeValue;

  @ApiProperty({ example: 2, description: 'Amount in hours or days depending on `type`.' })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ example: '2026-08-20', description: 'ISO date the leave starts.' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({
    example: '09:00',
    description: "Clock time ('HH:mm') the leave starts; only meaningful when type='hours'.",
  })
  @IsOptional()
  @IsString()
  startTime?: string | null;

  @ApiProperty({ example: 'Shifokor qabuli' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
