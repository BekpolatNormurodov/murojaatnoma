import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MeetingStatus, MeetingType } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/**
 * Body for `POST /meetings` — new yig'ilish scheduled from web-admin.
 * Mirrors the mock `Meeting` shape minus `id` (the server generates that,
 * `YIG-` prefixed like the seed).
 *
 * NOTE: the `Meeting` model has no join/link field (checked
 * `prisma/schema.prisma` + web-admin `types.ts`/`mock.ts` — none of them
 * carry one, even for `type: "video"` meetings, which just use a regular
 * `location` string), so this is plain CRUD over the existing columns.
 */
export class CreateMeetingDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ enum: MeetingType })
  @IsEnum(MeetingType)
  type!: MeetingType;

  @ApiPropertyOptional({ enum: MeetingStatus, description: 'Defaults to "scheduled"' })
  @IsOptional()
  @IsEnum(MeetingStatus)
  status?: MeetingStatus;

  @ApiProperty({ description: 'ISO datetime' })
  @IsISO8601()
  startAt!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  durationMin!: number;

  @ApiProperty({ description: 'Meeting room, address, or video-call link/label' })
  @IsString()
  location!: string;

  @ApiProperty({ description: "Raislik qiluvchi hokim o'rinbosari id" })
  @IsString()
  chairDeputyId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  agenda!: string[];

  @ApiProperty()
  @IsInt()
  @Min(0)
  participants!: number;

  @ApiProperty()
  @IsString()
  districtId!: string;
}
