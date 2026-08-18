import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/**
 * Body for `POST /bonuses` (web-admin "Premya berish" form). An admin
 * grants a bonus to a recipient identified by an `Employee` id, a `Worker`
 * id, or neither (a one-off/manual entry) — `recipientName` is always sent
 * so the admin UI and worker-app can render it without an extra join.
 */
export class CreateBonusDto {
  @ApiProperty({ example: 'Aliyev Vali', description: 'Denormalized display name of the recipient' })
  @IsString()
  @IsNotEmpty()
  recipientName!: string;

  @ApiProperty({ example: 500000, description: "Bonus summasi (so'mda)" })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ example: 'Oylik reja 120% bajarildi' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiProperty({ example: '2026-08', description: "Oy (masalan 'YYYY-MM')" })
  @IsString()
  @IsNotEmpty()
  month!: string;

  @ApiPropertyOptional({ description: 'Employee login id, when the recipient is an Employee' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Worker/Staff row id, when the recipient is a Worker' })
  @IsOptional()
  @IsString()
  workerId?: string;
}
