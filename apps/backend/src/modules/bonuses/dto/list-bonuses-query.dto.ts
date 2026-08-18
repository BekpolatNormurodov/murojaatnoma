import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** Query filters for `GET /bonuses` (web-admin premya history). */
export class ListBonusesQueryDto {
  @ApiPropertyOptional({ example: '2026-08', description: "Filter by oy ('YYYY-MM')" })
  @IsOptional()
  @IsString()
  month?: string;
}
