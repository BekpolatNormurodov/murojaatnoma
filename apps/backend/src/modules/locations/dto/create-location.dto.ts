import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LocationSource } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/** A single GPS report from an employee device. */
export class CreateLocationDto {
  @ApiProperty({ example: 41.3111 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 69.3402 })
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ description: 'Horizontal accuracy in meters' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @ApiPropertyOptional({ description: 'Speed in m/s' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  speed?: number;

  @ApiPropertyOptional({ description: 'Heading in degrees (0..360)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;

  @ApiPropertyOptional({ description: 'Battery level 0..100' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  battery?: number;

  @ApiPropertyOptional({ enum: LocationSource, default: LocationSource.FOREGROUND })
  @IsOptional()
  @IsEnum(LocationSource)
  source?: LocationSource;

  @ApiPropertyOptional({
    description: 'Device timestamp (ISO-8601). Defaults to server time if omitted.',
  })
  @IsOptional()
  @IsISO8601()
  recordedAt?: string;
}
