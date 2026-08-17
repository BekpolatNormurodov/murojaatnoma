import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestCategory } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * Body for `POST /deputies` — new deputy governor (hokim o'rinbosari)
 * profile from the web-admin form. Mirrors the mock `Deputy` shape minus
 * `id` (the server generates that).
 */
export class CreateDeputyDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  photo!: string;

  @ApiProperty({ description: "Yo'nalish rangi (avatar + badge)" })
  @IsString()
  color!: string;

  @ApiProperty({ example: "Hokimning birinchi o'rinbosari" })
  @IsString()
  position!: string;

  @ApiProperty({ description: "To'liq yo'nalish nomi" })
  @IsString()
  direction!: string;

  @ApiProperty({ description: "Qisqa yo'nalish" })
  @IsString()
  shortDirection!: string;

  @ApiPropertyOptional({
    enum: RequestCategory,
    isArray: true,
    description: "Shu o'rinbosar javob beradigan murojaat yo'nalishlari. Defaults to []",
  })
  @IsOptional()
  @IsArray()
  @IsEnum(RequestCategory, { each: true })
  categories?: RequestCategory[];

  @ApiPropertyOptional({
    type: [String],
    description: "Ko'rib chiqadigan asosiy masalalar (display). Defaults to []",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topics?: string[];

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty()
  @IsString()
  email!: string;

  @ApiProperty({ description: 'Kabinet raqami' })
  @IsString()
  office!: string;

  @ApiProperty({ description: 'Fuqarolar qabuli kuni' })
  @IsString()
  receptionDay!: string;
}
