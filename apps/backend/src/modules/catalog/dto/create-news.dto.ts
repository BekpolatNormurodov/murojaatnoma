import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NewsCategory, NewsStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/**
 * Body for `POST /news` — new news/e'lon published from web-admin. Mirrors
 * the mock `NewsItem` shape minus `id` (the server generates that, `n`
 * prefixed like the seed).
 */
export class CreateNewsDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  excerpt!: string;

  @ApiProperty()
  @IsString()
  body!: string;

  @ApiProperty({ enum: NewsCategory })
  @IsEnum(NewsCategory)
  category!: NewsCategory;

  @ApiPropertyOptional({ enum: NewsStatus, description: 'Defaults to "published"' })
  @IsOptional()
  @IsEnum(NewsStatus)
  status?: NewsStatus;

  @ApiProperty({ description: 'Cover image URL' })
  @IsString()
  cover!: string;

  @ApiProperty()
  @IsString()
  author!: string;

  @ApiPropertyOptional({ description: 'ISO datetime, defaults to now' })
  @IsOptional()
  @IsISO8601()
  publishedAt?: string;

  @ApiPropertyOptional({ description: 'Defaults to 0' })
  @IsOptional()
  @IsInt()
  @Min(0)
  views?: number;

  @ApiPropertyOptional({ description: 'Defaults to false' })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}
