import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const REPORT_ATTACHMENT_KINDS = ['image', 'voice', 'video', 'file'] as const;
export type ReportAttachmentKind = (typeof REPORT_ATTACHMENT_KINDS)[number];

/** Most files one report may carry. */
export const MAX_REPORT_ATTACHMENTS = 10;
/** A report may be filed for today or up to this many days back. */
export const REPORT_BACKDATE_DAYS = 7;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export class ReportAttachmentDto {
  @ApiProperty({ enum: REPORT_ATTACHMENT_KINDS })
  @IsIn(REPORT_ATTACHMENT_KINDS as unknown as string[])
  kind!: ReportAttachmentKind;

  @ApiProperty({ description: 'POST /uploads yoki /uploads/document qaytargan URL' })
  @IsString()
  @MaxLength(500)
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fileName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fileSize?: number;

  @ApiPropertyOptional({ description: 'Ovoz/video davomiyligi (soniya)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6 * 3600)
  durationSec?: number;
}

export class CreateDailyReportDto {
  @ApiPropertyOptional({ example: '2026-11-25', description: "Qaysi kun uchun (bo'sh = bugun, ko'pi bilan 7 kun orqaga)" })
  @IsOptional()
  @Matches(DAY_RE, { message: "Sana YYYY-MM-DD ko'rinishida bo'lsin" })
  day?: string;

  @ApiPropertyOptional({ example: "Olmazor mahallasida 12 ta xonadon o'rganildi" })
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Matn 5000 belgidan oshmasin' })
  text?: string;

  @ApiPropertyOptional({ type: [ReportAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REPORT_ATTACHMENTS, { message: `Bitta hisobotga ko'pi bilan ${MAX_REPORT_ATTACHMENTS} ta fayl` })
  @ValidateNested({ each: true })
  @Type(() => ReportAttachmentDto)
  attachments?: ReportAttachmentDto[];
}

export class DaysQueryDto {
  @ApiPropertyOptional({ example: 7, description: 'Bugundan necha kun orqaga (1..31)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  days?: number;
}

export class RangeQueryDto {
  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @Matches(DAY_RE, { message: "from YYYY-MM-DD ko'rinishida bo'lsin" })
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-25' })
  @IsOptional()
  @Matches(DAY_RE, { message: "to YYYY-MM-DD ko'rinishida bo'lsin" })
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;
}
