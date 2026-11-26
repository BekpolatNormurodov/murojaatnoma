import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const LOCATION_PERMISSIONS = ['always', 'whileInUse', 'denied'] as const;

/** What the worker-app knows about its own ability to report location. */
export class DeviceStatusDto {
  @ApiProperty({ description: 'Phone location service (GPS) switched on' })
  @IsBoolean()
  gpsEnabled!: boolean;

  @ApiProperty({ enum: LOCATION_PERMISSIONS })
  @IsIn(LOCATION_PERMISSIONS)
  permission!: (typeof LOCATION_PERMISSIONS)[number];

  @ApiProperty({ description: 'App is exempt from battery optimisation' })
  @IsBoolean()
  batteryExempt!: boolean;

  @ApiProperty({ description: 'Background tracking service is running' })
  @IsBoolean()
  tracking!: boolean;

  @ApiPropertyOptional({ description: 'Battery level 0..100' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  battery?: number;

  @ApiPropertyOptional({ example: '1.3.0+21' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;

  @ApiPropertyOptional({ example: 'Xiaomi Redmi Note 12 (Android 14)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  device?: string;
}
