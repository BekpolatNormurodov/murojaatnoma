import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GovDocStatus, GovDocType } from '@prisma/client';
import { IsEnum, IsISO8601, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Body for `POST /documents` — new hokimiyat hujjati registered from
 * web-admin. Mirrors the mock `GovDocument` shape minus `id` (the server
 * generates that, `D-` prefixed like the seed).
 */
export class CreateDocumentDto {
  @ApiProperty({ description: 'e.g. "QR-2026/118"' })
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ enum: GovDocType })
  @IsEnum(GovDocType)
  type!: GovDocType;

  @ApiPropertyOptional({ enum: GovDocStatus, description: 'Defaults to "draft"' })
  @IsOptional()
  @IsEnum(GovDocStatus)
  status?: GovDocStatus;

  @ApiProperty()
  @IsString()
  author!: string;

  @ApiProperty()
  @IsString()
  region!: string;

  @ApiPropertyOptional({ description: 'ISO datetime, defaults to now' })
  @IsOptional()
  @IsISO8601()
  createdAt?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sizeKb!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  pages!: number;
}
