import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

/** A local calendar day; today when omitted. */
export class DayQueryDto {
  @ApiPropertyOptional({ example: '2026-11-26' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  date?: string;
}
