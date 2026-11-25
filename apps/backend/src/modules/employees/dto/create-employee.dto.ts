import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeRole } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { E164_PHONE_REGEX } from '../../../common/constants/validation.constants';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Aliyev Vali Aliyevich' })
  @IsString()
  @MinLength(3)
  fullName!: string;

  @ApiProperty({ example: '+998901234567' })
  @Matches(E164_PHONE_REGEX, {
    message: 'phone must be a valid E.164 phone number, e.g. +998901234567',
  })
  phone!: string;

  @ApiProperty({ example: 'Bosh mutaxassis' })
  @IsString()
  position!: string;

  @ApiProperty({ example: 'Toshkent shahri' })
  @IsString()
  region!: string;

  @ApiProperty({ example: 'Yunusobod tumani' })
  @IsString()
  district!: string;

  @ApiPropertyOptional({ enum: EmployeeRole, default: EmployeeRole.EMPLOYEE })
  @IsOptional()
  @IsEnum(EmployeeRole)
  role?: EmployeeRole;

  @ApiPropertyOptional({
    type: [String],
    example: ['1090102', '1090103'],
    description:
      'Mahalla codes (from mahallas.geojson) this employee is assigned to for territory oversight. Empty = no territory (nothing counts as in-zone).',
  })
  // Not @IsOptional(): that would let `null` through to Prisma (500).
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  assignedMahallaCodes?: string[];
}
