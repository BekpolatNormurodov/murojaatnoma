import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CameraStatus, CameraType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/**
 * Body for `POST /cameras` — new CCTV camera registered from web-admin.
 * Mirrors the mock `Camera` shape minus `id` (the server generates that,
 * `CAM-` prefixed like the seed).
 */
export class CreateCameraDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  region!: string;

  @ApiProperty()
  @IsString()
  districtId!: string;

  @ApiProperty({ enum: CameraType })
  @IsEnum(CameraType)
  type!: CameraType;

  @ApiPropertyOptional({ enum: CameraStatus, description: 'Defaults to "online"' })
  @IsOptional()
  @IsEnum(CameraStatus)
  status?: CameraStatus;

  @ApiProperty()
  @IsNumber()
  lat!: number;

  @ApiProperty()
  @IsNumber()
  lng!: number;

  @ApiPropertyOptional({ description: 'Defaults to "1080p"' })
  @IsOptional()
  @IsString()
  resolution?: string;

  @ApiPropertyOptional({ description: 'Defaults to true' })
  @IsOptional()
  @IsBoolean()
  recording?: boolean;

  @ApiPropertyOptional({ description: 'Defaults to 100' })
  @IsOptional()
  @IsNumber()
  uptime?: number;

  @ApiPropertyOptional({ description: 'Defaults to 0' })
  @IsOptional()
  @IsInt()
  @Min(0)
  detections24h?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  lastEvent?: string | null;

  @ApiPropertyOptional({ description: 'Defaults to now' })
  @IsOptional()
  @IsISO8601()
  installedAt?: string;
}
