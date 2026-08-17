import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority, RequestCategory, RequestStatus } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Body for `POST /requests` — the web-admin "new murojaat" form. Mirrors the
 * mock `CitizenRequest` shape minus `id` (the server generates that, plus
 * `createdAt`).
 *
 * The web-admin `requests` store's `add()` action is typed as
 * `Omit<CitizenRequest, "id">`, so it may send along `createdAt`,
 * `resolvedAt`, `photos`, `responseHours`, `feedback` and `cost` too — all
 * accepted here (and validated) even though the server ignores/derives a
 * few of them, so the global `forbidNonWhitelisted` pipe doesn't 400 on a
 * good-faith payload.
 */
export class CreateRequestDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ enum: RequestCategory })
  @IsEnum(RequestCategory)
  category!: RequestCategory;

  @ApiPropertyOptional({ enum: RequestStatus, description: 'Defaults to "new"' })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiProperty()
  @IsString()
  region!: string;

  @ApiProperty()
  @IsString()
  districtId!: string;

  @ApiProperty()
  @IsString()
  address!: string;

  @ApiProperty()
  @IsString()
  citizenName!: string;

  @ApiProperty()
  @IsString()
  citizenPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  citizenPhoto?: string;

  // Ignored — the server always stamps its own `createdAt`. Accepted only so
  // sending the full `Omit<CitizenRequest, "id">` object doesn't 400.
  @ApiPropertyOptional({ description: 'Ignored — server always stamps its own createdAt' })
  @IsOptional()
  @IsISO8601()
  createdAt?: string;

  // Ignored — a freshly submitted request is never pre-resolved (server forces
  // null). Whitelisted only so the store's full `Omit<CitizenRequest,"id">`
  // payload (which carries resolvedAt) doesn't trip forbidNonWhitelisted → 400.
  @ApiPropertyOptional({ nullable: true, description: 'Ignored — server forces null on create' })
  @IsOptional()
  @IsISO8601()
  resolvedAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  assignedWorkerId?: string | null;

  @ApiProperty({ enum: Priority })
  @IsEnum(Priority)
  priority!: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  responseHours?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  feedback?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  cost?: number;
}
