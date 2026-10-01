import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const MEDIA_PERIODS = ['24h', '7d', '30d', 'all'] as const;
export type MediaPeriod = (typeof MEDIA_PERIODS)[number];
export const MEDIA_PLATFORMS = ['web', 'telegram', 'youtube', 'instagram'] as const;
export const MEDIA_SENTIMENTS = ['positive', 'neutral', 'negative'] as const;
export const MEDIA_STATUSES = ['new', 'seen', 'important', 'hidden'] as const;

export class MediaOverviewQueryDto {
  @ApiPropertyOptional({ enum: MEDIA_PERIODS, default: '24h' })
  @IsOptional()
  @IsIn(MEDIA_PERIODS)
  period?: MediaPeriod;

  @ApiPropertyOptional({ description: '0..100; default — sozlamadagi minRelevance' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minRelevance?: number;
}

export class ListMediaQueryDto extends MediaOverviewQueryDto {
  @ApiPropertyOptional({ enum: MEDIA_PLATFORMS })
  @IsOptional()
  @IsIn(MEDIA_PLATFORMS)
  platform?: (typeof MEDIA_PLATFORMS)[number];

  @ApiPropertyOptional({ enum: MEDIA_SENTIMENTS })
  @IsOptional()
  @IsIn(MEDIA_SENTIMENTS)
  sentiment?: (typeof MEDIA_SENTIMENTS)[number];

  @ApiPropertyOptional({ enum: MEDIA_STATUSES, description: "Bo'sh — yashirilganlardan tashqari hammasi" })
  @IsOptional()
  @IsIn(MEDIA_STATUSES)
  status?: (typeof MEDIA_STATUSES)[number];

  @ApiPropertyOptional({ example: 'Kommunal xizmatlar' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  topic?: string;

  @ApiPropertyOptional({ enum: ['story', 'none'], default: 'story', description: "Bir voqea bir kartada (filtrlar qo'llanganda o'chadi)" })
  @IsOptional()
  @IsIn(['story', 'none'])
  group?: 'story' | 'none';

  @ApiPropertyOptional({ enum: ['official', 'media'], description: 'Rasmiy (davlat) manbalar yoki OAV' })
  @IsOptional()
  @IsIn(['official', 'media'])
  kind?: 'official' | 'media';

  @ApiPropertyOptional({ example: 'tg:daryo', description: 'MediaItem.source' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @ApiPropertyOptional({ description: 'Sarlavha / matn / xulosa / manba bo‘yicha qidiruv' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdateMediaItemDto {
  @ApiPropertyOptional({ enum: MEDIA_STATUSES })
  @IsOptional()
  @IsIn(MEDIA_STATUSES)
  status?: (typeof MEDIA_STATUSES)[number];

  @ApiPropertyOptional({ enum: MEDIA_SENTIMENTS, description: "Admin baholashni qo'lda to'g'irlashi" })
  @IsOptional()
  @IsIn(MEDIA_SENTIMENTS)
  sentiment?: (typeof MEDIA_SENTIMENTS)[number];
}

export class MarkSeenDto {
  @ApiPropertyOptional({ type: [String], description: "Bo'sh — barcha yangi xabarlar" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids?: string[];
}

export class MediaFeedDto {
  @Matches(/^[a-z0-9-]{2,30}$/, { message: "Kalit faqat kichik lotin harf, raqam va '-' (2-30)" })
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @Matches(/^https?:\/\/[^\s]{4,300}$/i, { message: "RSS manzili http(s):// bilan boshlanishi kerak" })
  url!: string;

  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj.enabled)
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj.official)
  @IsBoolean()
  official?: boolean;
}

export class GovAuthorityDto {
  @Matches(/^[a-z0-9-]{2,60}$/, { message: 'gov.uz manzil qismi (masalan: mirzoulugbek)' })
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj.own)
  @IsBoolean()
  own!: boolean;
}

/** Optional list of short phrases (keywords, channels, hashtags). */
const WordList = () =>
  applyDecorators(IsOptional(), IsArray(), ArrayMaxSize(150), IsString({ each: true }), MaxLength(100, { each: true }));

export class UpdateMediaSettingsDto {
  @ApiPropertyOptional({ type: [String] })
  @WordList()
  keywords?: string[];

  @ApiPropertyOptional({ type: [String] })
  @WordList()
  weakKeywords?: string[];

  @ApiPropertyOptional({ type: [String] })
  @WordList()
  excludes?: string[];

  @ApiPropertyOptional({ type: [String], description: "Tuman joylari (massivlar); mahallalar zonalardan avtomatik" })
  @WordList()
  placeKeywords?: string[];

  @ApiPropertyOptional({ type: [MediaFeedDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(150)
  @ValidateNested({ each: true })
  @Type(() => MediaFeedDto)
  rssFeeds?: MediaFeedDto[];

  @ApiPropertyOptional({ type: [String] })
  @WordList()
  telegramChannels?: string[];

  @ApiPropertyOptional({ type: [String] })
  @WordList()
  officialTelegramChannels?: string[];

  @ApiPropertyOptional({ type: [String] })
  @WordList()
  localTelegramChannels?: string[];

  @ApiPropertyOptional({ type: [String] })
  @WordList()
  telegramSearchQueries?: string[];

  @ApiPropertyOptional({ type: [String] })
  @WordList()
  youtubeSearchQueries?: string[];

  @ApiPropertyOptional({ type: [GovAuthorityDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => GovAuthorityDto)
  govAuthorities?: GovAuthorityDto[];

  @ApiPropertyOptional({ type: [String], example: ['gov.uz', 'president.uz'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @Matches(/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}\/?$/i, { each: true, message: 'Domen: masalan gov.uz' })
  googleNewsSites?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @Matches(/^UC[\w-]{22}$/, { each: true, message: 'YouTube kanal ID UC... (24 belgi) bo‘lishi kerak' })
  youtubeChannels?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @Matches(/^UC[\w-]{22}$/, { each: true, message: 'YouTube kanal ID UC... (24 belgi) bo‘lishi kerak' })
  officialYoutubeChannels?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Matches(/^UC[\w-]{22}$/, { each: true, message: 'YouTube kanal ID UC... (24 belgi) bo‘lishi kerak' })
  ownYoutubeChannels?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  youtubeQuery?: string;

  @ApiPropertyOptional({ type: [String] })
  @WordList()
  instagramHashtags?: string[];

  @ApiPropertyOptional({ type: [String] })
  @WordList()
  instagramAccounts?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  googleNewsQuery?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minRelevance?: number;

  /** Sent back by the web form as-is; the server always stores the current version. */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  sourcesVersion?: number;

  @ApiPropertyOptional({ description: "AI tahlil (Claude) — ANTHROPIC_API_KEY bo'lsa ishlaydi" })
  @IsOptional()
  // Raw value: enableImplicitConversion would turn "false"/"yes" into true.
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj.aiEnabled)
  @IsBoolean()
  aiEnabled?: boolean;
}
