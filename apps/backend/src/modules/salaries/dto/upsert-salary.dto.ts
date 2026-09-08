import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Set (create or replace) one employee's salary for a given calendar month.
 * Keyed by (employeeId, year, month) — sending the same triple again edits it.
 */
export class UpsertSalaryDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  @IsString()
  employeeId!: string;

  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiProperty({ example: 9, description: '1..12' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({ example: 6000000, description: "Base salary for the month, so'm (UZS)" })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ example: 500000, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bonus?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  penalty?: number;

  @ApiPropertyOptional({ example: 'Oylik + KPI ustama' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: '2026-09-05T00:00:00.000Z', description: "To'langan sana (ISO)" })
  @IsOptional()
  @IsString()
  paidAt?: string;
}
