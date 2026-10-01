import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Matches, Max, Min, MinLength } from 'class-validator';

/**
 * Admin create/edit of an employee (person) straight from the web-admin Nazorat
 * page — name, position, login (username/password), photo, salary, territory.
 * On create, username+password are required (so they can sign into worker-app);
 * on edit they're optional (only rotate the password when a new one is sent).
 */
export class UpsertEmployeeDto {
  @ApiProperty({ example: 'Ismoilov Xurshid' })
  @IsString()
  @MinLength(3, { message: "F.I.Sh. kamida 3 harf bo'lsin" })
  fullName!: string;

  @ApiProperty({ example: 'Bosh mutaxassis' })
  @IsString()
  @MinLength(2, { message: 'Lavozimni kiriting' })
  position!: string;

  @ApiPropertyOptional({ example: '+998901234567', description: 'E.164; auto-placeholder if omitted on create' })
  @IsOptional()
  @IsString()
  @Matches(/^\+998\d{9}$/, { message: "Telefon: +998 va 9 ta raqam (masalan +998901234567)" })
  phone?: string;

  @ApiPropertyOptional({ example: 'xurshid', description: 'worker-app login (required on create)' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_]{3,32}$/, { message: 'Username: 3–32 ta kichik lotin harf, raqam yoki _' })
  username?: string;

  @ApiPropertyOptional({ example: 'Parol123', description: 'worker-app password (required on create; on edit rotates it)' })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: "Parol kamida 6 belgidan iborat bo'lsin" })
  password?: string;

  @ApiPropertyOptional({ example: 'https://murojaatnoma.uz/uploads/abc.png' })
  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

  @ApiPropertyOptional({ example: 6000000, description: "Shu oy uchun oylik (so'm)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Oylik butun son bo'lsin" })
  @Min(0, { message: "Oylik manfiy bo'lmaydi" })
  salary?: number;

  @ApiPropertyOptional({ example: 2026, description: 'Oylik qaysi yil uchun (default: joriy)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  salaryYear?: number;

  @ApiPropertyOptional({ example: 10, description: 'Oylik qaysi oy uchun, 1..12 (default: joriy)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  salaryMonth?: number;

  @ApiPropertyOptional({ type: [String], example: ['1090080', '1090082'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedMahallaCodes?: string[];
}
