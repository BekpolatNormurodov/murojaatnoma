import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({ description: 'Recipient employee id' })
  @IsString()
  employeeId!: string;

  @ApiProperty({ example: 'Davomat eslatmasi' })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty({ example: 'Ish kuni boshlanishiga 15 daqiqa qoldi.' })
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiPropertyOptional({ enum: NotificationType, default: NotificationType.GENERAL })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}
